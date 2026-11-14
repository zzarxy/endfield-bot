// Sets up the support server through the bot's own token: categories, channels, read-only/private permissions,
// forum tags, safety settings, AutoMod rules and the bot's welcome/announcement posts.
// Idempotent: channels and roles are matched by name, the bot edits its own earlier posts instead of reposting,
// existing permission overwrites of other roles/users are kept, nothing is deleted.
// Dry run by default; --apply makes the changes. Run via scripts/support-server.ps1 (asks for the token).
import { readFileSync } from "node:fs";
import { discord } from "../src/lib/discord.ts";
import { BRAND_COLOR, FLAG_V2, container, gallery, linkButton, row, separator, text, type Component } from "../src/lib/ui.ts";
import { APP_ID, INVITE_URL, SUPPORT_URL, USER_INSTALL_URL } from "../src/lib/links.ts";

const GUILD = process.env.GUILD_ID ?? "1568508677873340576";
const SITE = "https://endfield-bot.endfield-bot.workers.dev";
const REPO = "https://github.com/zzarxy/endfield-bot";
const APPLY = process.argv.includes("--apply");
const token = (process.env.DISCORD_TOKEN ?? "").trim();
if (token.length < 50) throw new Error("Set DISCORD_TOKEN (run scripts/support-server.ps1)");

const bit = (n: number) => 1n << BigInt(n);
const P = {
  MANAGE_CHANNELS: bit(4), MANAGE_GUILD: bit(5), ADD_REACTIONS: bit(6), VIEW: bit(10), SEND: bit(11), MANAGE_MESSAGES: bit(13),
  EMBED: bit(14), ATTACH: bit(15), HISTORY: bit(16), MANAGE_ROLES: bit(28), MANAGE_THREADS: bit(34),
  CREATE_PUBLIC_THREADS: bit(35), SEND_IN_THREADS: bit(38),
};
const ADMIN = bit(3);
const NEEDED: bigint = Object.values(P).reduce((a: bigint, b: bigint) => a | b, 0n);
const BOT_ALLOW = P.VIEW | P.SEND | P.EMBED | P.ATTACH | P.HISTORY | P.MANAGE_MESSAGES | P.SEND_IN_THREADS | P.MANAGE_THREADS;
const PERM_NAMES = Object.fromEntries(Object.entries(P).map(([k, v]) => [v.toString(), k]));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function api(method: string, path: string, body?: unknown): Promise<any> {
  const res = await discord(token, method, path, body);
  if (res.status === 429) {
    const j: any = await res.json();
    await sleep(Math.ceil((j.retry_after ?? 1) * 1000) + 100);
    return api(method, path, body);
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 400)}`);
  return res.status === 204 ? null : res.json();
}
let planned = 0;
async function act<T>(desc: string, fn: () => Promise<T>): Promise<T | undefined> {
  planned++;
  console.log((APPLY ? "• " : "would: ") + desc);
  return APPLY ? fn() : undefined;
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "");

// ---------- access ----------
const me = await api("GET", "/users/@me");
if (me.id !== APP_ID) throw new Error(`This token belongs to ${me.username} (${me.id}), not Endfield Helper`);
const addUrl = `https://discord.com/oauth2/authorize?client_id=${APP_ID}&scope=bot+applications.commands&permissions=${NEEDED}&guild_id=${GUILD}&disable_guild_select=true`;
const probe = await discord(token, "GET", `/guilds/${GUILD}`);
if (!probe.ok) {
  console.log(`The bot is not in the support server yet (${probe.status}). Open this link, confirm, then run the script again:\n${addUrl}`);
  process.exit(2);
}
const guild: any = await probe.json();
const roles: any[] = await api("GET", `/guilds/${GUILD}/roles`);
const member = await api("GET", `/guilds/${GUILD}/members/${APP_ID}`);
const perms = roles.filter((r) => r.id === GUILD || member.roles.includes(r.id)).reduce((a: bigint, r) => a | BigInt(r.permissions), 0n);
const missing: bigint = (perms & ADMIN) !== 0n ? 0n : NEEDED & ~perms;
if (missing !== 0n) {
  const names = Object.values(P).filter((p) => (missing & p) !== 0n).map((p) => PERM_NAMES[p.toString()]);
  console.log(`The bot role lacks: ${names.join(", ")}.\nOpen this link to grant them (you can lower them after the setup), then run again:\n${addUrl}`);
  process.exit(2);
}
const botRole = roles.find((r) => r.tags?.bot_id === APP_ID);
if (!botRole) throw new Error("Bot role not found");
console.log(`Server: ${guild.name} · features: ${guild.features.join(", ")} · ${APPLY ? "APPLYING" : "dry run"}\n`);

// ---------- roles ----------
const ROLE_SPECS = [
  { name: "Translator", color: 0x1abc9c, hoist: false },
  { name: "Supporter", color: BRAND_COLOR, hoist: true },
];
for (const spec of ROLE_SPECS) {
  if (roles.some((r) => norm(r.name) === norm(spec.name))) continue;
  await act(`create role @${spec.name}`, () => api("POST", `/guilds/${GUILD}/roles`, { ...spec, permissions: "0", mentionable: false }));
}

// ---------- channels ----------
type Access = "open" | "readonly" | "private";
interface Spec { key: string; name: string; aliases: string[]; type: number; parent?: string; topic?: string; access?: Access; slowmode?: number }
const CATEGORIES: Spec[] = [
  { key: "c_info", name: "📌 Info", aliases: ["info", "information", "информация"], type: 4 },
  { key: "c_community", name: "💬 Community", aliases: ["community", "chat", "сообщество"], type: 4 },
  { key: "c_support", name: "🛠 Support", aliases: ["support", "поддержка"], type: 4 },
  { key: "c_staff", name: "🔒 Staff", aliases: ["staff", "mods", "moderators"], type: 4, access: "private" },
];
const CHANNELS: Spec[] = [
  { key: "welcome", name: "welcome", aliases: ["welcome", "rules", "start-here", "правила"], type: 0, parent: "c_info", access: "readonly",
    topic: "What the bot does, how to add it, and the server rules." },
  { key: "announcements", name: "announcements", aliases: ["announcements", "news", "updates", "объявления"], type: 5, parent: "c_info", access: "readonly",
    topic: "Bot updates. Press Follow to get them in your own server." },
  { key: "endfield_news", name: "endfield-news", aliases: ["endfield-news", "banners", "game-news"], type: 0, parent: "c_info", access: "readonly",
    topic: "Banners, events and reset reminders posted by Endfield Helper (/notify)." },
  { key: "general", name: "general", aliases: ["general", "chat", "основной", "общий"], type: 0, parent: "c_community",
    topic: "Chat about Endfield and the bot. English preferred, other languages welcome." },
  { key: "playground", name: "bot-playground", aliases: ["bot-playground", "bot-commands", "commands", "bots"], type: 0, parent: "c_community",
    topic: "Try the bot here: /operator, /factory, /banner, /reset…" },
  { key: "help", name: "help", aliases: ["help", "support", "bugs", "помощь"], type: 15, parent: "c_support",
    topic: "One post per problem. Pick a tag. For bugs: the command you used, what you expected, what happened, a screenshot.", slowmode: 300 },
  { key: "feedback", name: "feedback", aliases: ["feedback", "ideas", "suggestions", "идеи"], type: 0, parent: "c_support",
    topic: "Ideas and wishes. One idea per message, react 👍 to support others.", slowmode: 30 },
  { key: "translations", name: "translations", aliases: ["translations", "translation", "переводы"], type: 0, parent: "c_support",
    topic: "Fixes for RU, UK, ES, JA, KO and ZH texts: language · where · current text · better text.", slowmode: 30 },
  { key: "modlog", name: "mod-log", aliases: ["mod-log", "modlog", "moderator-only", "staff", "logs"], type: 0, parent: "c_staff", access: "private",
    topic: "AutoMod alerts and Discord community updates. Staff only." },
];

const channels: any[] = await api("GET", `/guilds/${GUILD}/channels`);
const ids: Record<string, string> = {};
const mention = (key: string) => (ids[key] ? `<#${ids[key]}>` : `#${CHANNELS.find((c) => c.key === key)!.name}`);

// Only adds bits: Discord refuses (50013) to remove allows/denies for permissions the bot itself doesn't hold.
function overwrites(existing: any[], access: Access | undefined): any[] {
  const list = (existing ?? []).map((o) => ({ id: o.id, type: o.type, allow: String(o.allow), deny: String(o.deny) }));
  const merge = (id: string, allow: bigint, deny: bigint) => {
    const o = list.find((x) => x.id === id) ?? (list.push({ id, type: 0, allow: "0", deny: "0" }), list[list.length - 1]);
    o.allow = String((BigInt(o.allow) | allow) & ~deny);
    o.deny = String((BigInt(o.deny) | deny) & ~allow);
  };
  if (access === "readonly") { merge(GUILD, 0n, P.SEND | P.CREATE_PUBLIC_THREADS | P.SEND_IN_THREADS); merge(botRole.id, BOT_ALLOW, 0n); }
  if (access === "private") { merge(GUILD, 0n, P.VIEW); merge(botRole.id, BOT_ALLOW, 0n); }
  return list;
}
const sameOverwrites = (a: any[], b: any[]) =>
  JSON.stringify((a ?? []).map((o) => [o.id, String(o.allow), String(o.deny)]).sort()) ===
  JSON.stringify((b ?? []).map((o) => [o.id, String(o.allow), String(o.deny)]).sort());

const FORUM_TAGS = [
  { name: "Bug", emoji_name: "🐞" }, { name: "Question", emoji_name: "❓" },
  { name: "Idea", emoji_name: "💡" }, { name: "Translation", emoji_name: "🌐" },
];

async function ensure(spec: Spec) {
  // categories inherit nothing; channels inside a private category get the private overwrites themselves
  const found = channels.find((c) => c.type === spec.type && spec.aliases.some((a) => norm(c.name) === norm(a)))
    ?? (spec.type === 5 ? channels.find((c) => c.type === 0 && spec.aliases.some((a) => norm(c.name) === norm(a))) : undefined);
  const parent = spec.parent ? ids[spec.parent] : undefined;
  const wantOverwrites = overwrites(found?.permission_overwrites, spec.access);
  const body: Record<string, unknown> = {};
  if (spec.topic !== undefined && spec.type !== 4) body.topic = spec.topic;
  if (spec.parent) body.parent_id = parent ?? null;
  if (spec.slowmode !== undefined) body.rate_limit_per_user = spec.slowmode;
  if (spec.access) body.permission_overwrites = wantOverwrites;
  if (spec.type === 15) {
    const have: any[] = found?.available_tags ?? [];
    body.available_tags = [...have, ...FORUM_TAGS.filter((t) => !have.some((h) => norm(h.name) === norm(t.name)))];
    body.default_reaction_emoji = { emoji_name: "👍" };
    body.default_thread_rate_limit_per_user = 5;
    body.flags = 16; // REQUIRE_TAG
  }
  if (!found) {
    const created = await act(`create ${spec.type === 4 ? "category" : "channel"} ${spec.name}`, () =>
      api("POST", `/guilds/${GUILD}/channels`, { name: spec.name, type: spec.type, ...body }));
    if (created) { ids[spec.key] = created.id; channels.push(created); }
    return;
  }
  ids[spec.key] = found.id;
  const diff: Record<string, unknown> = {};
  // the community updates/rules channel must stay a text channel; converted after the settings move below
  if (found.type === 0 && spec.type === 5 && ![guild.public_updates_channel_id, guild.rules_channel_id].includes(found.id)) diff.type = 5;
  if ("topic" in body && (found.topic ?? "") !== body.topic) diff.topic = body.topic;
  if ("parent_id" in body && body.parent_id !== undefined && found.parent_id !== body.parent_id && body.parent_id !== null) diff.parent_id = body.parent_id;
  if ("rate_limit_per_user" in body && found.rate_limit_per_user !== body.rate_limit_per_user) diff.rate_limit_per_user = body.rate_limit_per_user;
  if (spec.access && !sameOverwrites(found.permission_overwrites, wantOverwrites)) diff.permission_overwrites = wantOverwrites;
  if (spec.type === 15) {
    if ((body.available_tags as any[]).length !== (found.available_tags ?? []).length) diff.available_tags = body.available_tags;
    if (found.default_reaction_emoji?.emoji_name !== "👍") diff.default_reaction_emoji = body.default_reaction_emoji;
    if (found.default_thread_rate_limit_per_user !== 5) diff.default_thread_rate_limit_per_user = 5;
    if (((found.flags ?? 0) & 16) === 0) diff.flags = (found.flags ?? 0) | 16;
  }
  if (Object.keys(diff).length)
    await act(`update #${found.name}: ${Object.keys(diff).join(", ")}`, () => api("PATCH", `/channels/${found.id}`, diff));
}
for (const c of CATEGORIES) await ensure(c);
for (const c of CHANNELS) await ensure(c);

// order: categories first in our order, channels in spec order inside them
const order = [...CATEGORIES, ...CHANNELS].filter((s) => ids[s.key]);
const positions = order.map((s, i) => ({ id: ids[s.key], position: i }));
const current = (id: string) => channels.find((c) => c.id === id)?.position;
if (positions.some((p) => current(p.id) !== p.position))
  await act("reorder categories and channels", () => api("PATCH", `/guilds/${GUILD}/channels`, positions));

// ---------- server settings ----------
const settings: Record<string, unknown> = {
  verification_level: 2, // Medium: verified email + account older than 5 minutes
  explicit_content_filter: 2, // scan media from all members
  default_message_notifications: 1, // only @mentions
  description: "Support and feedback for Endfield Helper, a free fan-made Discord bot for Arknights: Endfield.",
};
if (ids.welcome) settings.rules_channel_id = ids.welcome;
if (ids.modlog) { settings.public_updates_channel_id = ids.modlog; settings.safety_alerts_channel_id = ids.modlog; }
if (ids.general) settings.system_channel_id = ids.general;
const settingsDiff = Object.fromEntries(Object.entries(settings).filter(([k, v]) => guild[k] !== v));
if (!guild.icon) settingsDiff.icon = "data:image/png;base64," + readFileSync("public/img/avatar.png").toString("base64");
// changing the Community Updates channel needs Administrator, which the bot doesn't get; it is a manual step
const manual: string[] = [];
const pubUpdates = settingsDiff.public_updates_channel_id;
delete settingsDiff.public_updates_channel_id;
if (pubUpdates) manual.push("Server Settings > Community > Overview > Community Updates Channel: pick #mod-log, then run this script again (it turns #announcements into a followable announcement channel).");
if (Object.keys(settingsDiff).length)
  await act(`server settings: ${Object.keys(settingsDiff).join(", ")}`, () => api("PATCH", `/guilds/${GUILD}`, settingsDiff));

// announcements -> announcement channel, now that community updates go to #mod-log
const ann = channels.find((c) => c.id === ids.announcements);
if (ann?.type === 0 && !pubUpdates && ann.id !== guild.public_updates_channel_id)
  await act("make #announcements an announcement (followable) channel", () => api("PATCH", `/channels/${ann.id}`, { type: 5 }));

// ---------- AutoMod ----------
const rules: any[] = await api("GET", `/guilds/${GUILD}/auto-moderation/rules`);
const alert = ids.modlog ? [{ type: 2, metadata: { channel_id: ids.modlog } }] : [];
const block = (msg: string) => ({ type: 1, metadata: { custom_message: msg } });
const AUTOMOD = [
  { name: "Spam", trigger_type: 3, actions: [block("This looks like spam."), ...alert] },
  { name: "Mention spam", trigger_type: 5, trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true }, actions: [block("Too many mentions."), ...alert] },
  { name: "Slurs", trigger_type: 4, trigger_metadata: { presets: [3] }, actions: [block("Please keep it civil."), ...alert] },
  {
    name: "Invites to other servers", trigger_type: 1,
    trigger_metadata: {
      keyword_filter: ["*discord.gg/*", "*discord.com/invite/*", "*discordapp.com/invite/*"],
      allow_list: [`*${SUPPORT_URL.replace("https://", "")}*`],
    },
    actions: [block("Invites to other servers aren't allowed here."), ...alert],
  },
];
for (const r of AUTOMOD) {
  // spam, mention and preset rules are limited to one per server, so match those by trigger type
  const exists = rules.some((x) => (r.trigger_type === 1 ? x.name === r.name : x.trigger_type === r.trigger_type));
  if (exists) continue;
  await act(`AutoMod rule "${r.name}"`, () => api("POST", `/guilds/${GUILD}/auto-moderation/rules`, { ...r, event_type: 1, enabled: true }));
}

// ---------- posts ----------
const LEGAL = `-# Unofficial fan project, not affiliated with GRYPHLINE or Hypergryph. Game data: Endfield Talos Wiki (CC BY-SA 4.0). [Terms](${SITE}/terms) · [Privacy](${SITE}/privacy)`;
const installRow = row(
  linkButton("Add to your account", USER_INSTALL_URL),
  linkButton("Add to a server", INVITE_URL),
  linkButton("Website", SITE),
  linkButton("Source code", REPO),
);
const card = (parts: Component[]) => ({ flags: FLAG_V2, components: [container(BRAND_COLOR, parts)] });

const POSTS: { key: string; body: () => any; publish?: boolean }[] = [
  {
    key: "welcome",
    body: () => card([
      gallery(`${SITE}/img/hero.png`),
      text(`# Welcome to Endfield Helper Support
**Endfield Helper** is a free, unofficial Discord bot for **Arknights: Endfield**: operator, weapon, gear, item and enemy cards, an AIC factory calculator, and banners, events and resets in your own timezone. Interface in English, Русский, Українська, Español, 日本語, 한국어, 简体中文 and 繁體中文.`),
      separator(),
      text(`## Add the bot
**To your account:** use it in any server or DM, no admin rights needed.
**To a server:** for server admins; also enables \`/notify\` channel alerts.`),
      installRow,
      separator(),
      text(`## Where to go
${mention("help")}: bugs and questions, one post per problem
${mention("feedback")}: ideas and wishes
${mention("translations")}: fixes for the translated texts
${mention("playground")}: try the commands
${mention("announcements")}: bot updates · ${mention("endfield_news")}: live banner and event alerts`),
      separator(),
      text(`## Rules
1. Be kind. No harassment, hate speech or NSFW.
2. Stay on topic: the bot and Endfield. No ads or invites to other servers.
3. Never share passwords, tokens or account data. Staff will never ask for them.
4. Spoiler-tag new story content and leaks.
5. Follow Discord's [Terms of Service](https://discord.com/terms) and [Community Guidelines](https://discord.com/guidelines).`),
      separator(),
      text(LEGAL),
    ]),
  },
  {
    key: "announcements",
    publish: true,
    body: () => card([
      gallery(`${SITE}/img/factory.png`),
      text(`# Endfield Helper is live
- \`/operator\` \`/weapon\` \`/gear\` \`/item\` \`/enemy\`: wiki cards with skills, talents, materials and stats
- \`/factory\`: type a product and a rate, get the whole AIC chain with machines, raw input per minute and power
- \`/banner\` \`/events\` \`/reset\`: what's on now and next, in your own timezone
- \`/notify\`: new banners, events and reset reminders in a channel of your server
- 8 languages, names searchable in any of them; replies are private until you press **Show everyone**

**Free:** every lookup command is free, and one \`/notify\` channel per server is free. An optional Supporter plan for more channels may come later.
Found a bug or a clumsy translation? Tell us in ${mention("help")} or ${mention("translations")}.`),
      installRow,
    ]),
  },
  {
    key: "playground",
    body: () => card([text(`## Try the bot here
\`/operator name: Arclight\` · \`/factory product: … rate: 30\` · \`/banner\` · \`/reset\` · \`/help\`
Replies are private to you; press **Show everyone** to share a card with the channel.
No bot in your own server yet? Add it to your account and it works everywhere.`), installRow]),
  },
  {
    key: "feedback",
    body: () => card([text(`## Ideas and wishes
One idea per message, and react 👍 to the ideas you want too, so we can see what matters most.
Bugs go to ${mention("help")}, translation fixes to ${mention("translations")}.`)]),
  },
  {
    key: "translations",
    body: () => card([text(`## Translation fixes
The texts in RU, UK, ES, JA, KO and ZH were written without a native-speaker review, so fixes are very welcome.
Please post: **language · where you saw it** (command or button) **· current text · better text**.
Accepted fixes earn the **@Translator** role. Skill and item descriptions come from the wiki in English only.`)]),
  },
];

async function upsertPost(key: string, body: any, publish = false) {
  const channelId = ids[key];
  if (!channelId) { await act(`post in #${CHANNELS.find((c) => c.key === key)!.name} (after it is created)`, async () => null); return; }
  const msgs: any[] = await api("GET", `/channels/${channelId}/messages?limit=50`);
  const mine = msgs.filter((m) => m.author?.id === APP_ID).pop(); // oldest of the bot's posts
  if (mine) {
    await act(`edit bot post in #${key}`, () => api("PATCH", `/channels/${channelId}/messages/${mine.id}`, body));
    return;
  }
  const posted = await act(`post in #${key}`, () => api("POST", `/channels/${channelId}/messages`, body));
  const isNews = channels.find((c) => c.id === channelId)?.type === 5;
  if (posted && publish && isNews) await act(`publish #${key} post to followers`, () => api("POST", `/channels/${channelId}/messages/${posted.id}/crosspost`));
}
for (const p of POSTS) await upsertPost(p.key, p.body(), p.publish);

// forum: pinned "read me first" post
const README = "Read me first: how to get help";
const readmeBody = card([text(`## How to get help
1. Search the existing posts first, your question may be answered already.
2. One post per problem, with a tag: **Bug**, **Question**, **Idea** or **Translation**.
3. For bugs, include the command and options you used, what you expected, what happened, a screenshot and your Discord language.
4. The bot and the staff will never ask for your password or tokens.

**Known limits:** skill, talent and item descriptions are English only (the wiki has them only in English). Game data syncs from the Talos Wiki every night, so a brand-new banner can take up to a day to appear.`)]);
if (ids.help) {
  const active: any = await api("GET", `/guilds/${GUILD}/threads/active`);
  const archived: any = await api("GET", `/channels/${ids.help}/threads/archived/public?limit=50`).catch(() => ({ threads: [] }));
  const thread = [...active.threads, ...archived.threads].find((t: any) => t.parent_id === ids.help && t.name === README);
  if (thread) {
    await act("edit forum read-me post", () => api("PATCH", `/channels/${thread.id}/messages/${thread.id}`, readmeBody));
  } else {
    const forum = channels.find((c) => c.id === ids.help) ?? (await api("GET", `/channels/${ids.help}`));
    const tagId = (forum.available_tags ?? []).find((t: any) => t.name === "Question")?.id;
    const created = await act("create pinned forum read-me post", () =>
      api("POST", `/channels/${ids.help}/threads`, { name: README, message: readmeBody, applied_tags: tagId ? [tagId] : [] }));
    if (created) await api("PATCH", `/channels/${(created as any).id}`, { flags: 2 }); // pinned
  }
} else {
  await act("create pinned forum read-me post (after the forum is created)", async () => null);
}

console.log(`\n${planned ? `${planned} change(s) ${APPLY ? "applied" : "planned"}` : "Nothing to change"}.`);
if (!APPLY && planned) console.log("Run again with --apply to make these changes.");
if (manual.length) console.log(`\nManual step (needs the server owner):\n- ${manual.join("\n- ")}`);
if (APPLY && ids.endfield_news)
  console.log(`\nLast step (in Discord): run /notify subscribe in #endfield-news with channel: #endfield-news, server: Americas/Europe, language: English, resets: True.`);
