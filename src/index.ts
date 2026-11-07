// Cloudflare Worker entry: Discord HTTP interactions + cron notifications.
import { InteractionType, InteractionResponseType, ComponentType, TextInputStyle } from "discord-api-types/v10";
import { verifyDiscordRequest } from "./lib/verify.ts";
import { render, helpView, type Ctx } from "./views.ts";
import { wikiCard, suggest } from "./wiki.ts";
import { choices } from "./lib/search.ts";
import { data, producible, allRecipeItems } from "./data/index.ts";
import { FLAG_EPHEMERAL, FLAG_V2, container, text, row, linkButton, BRAND_COLOR, type Component } from "./lib/ui.ts";
import { subscribe, unsubscribe, list, runCron, dueFor, deleteGuildData, type Env, type Sub } from "./notify.ts";
import { legalPage } from "./legal.ts";
import { discord } from "./lib/discord.ts";
import { t, localeToLang, LANGS, type Lang } from "./i18n.ts";
import { syncCommands } from "./register.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const message = (components: Component[], ephemeral: boolean) =>
  json({ type: InteractionResponseType.ChannelMessageWithSource, data: { flags: FLAG_V2 | (ephemeral ? FLAG_EPHEMERAL : 0), components } });

const update = (components: Component[]) => json({ type: InteractionResponseType.UpdateMessage, data: { flags: FLAG_V2, components } });

const notice = (s: string, extra: Component[] = []) => message([container(BRAND_COLOR, [text(s), ...extra])], true);

const opt = (options: any[] | undefined, name: string) => options?.find((o) => o.name === name)?.value;

const GEAR_AND_SETS = [...data.sets, ...data.gear];

const AUTOCOMPLETE_SOURCES: Record<string, () => { name: string; names?: Partial<Record<Lang, string>> }[]> = {
  operator: () => data.operators,
  weapon: () => data.weapons,
  gear: () => GEAR_AND_SETS,
  item: () => data.items,
  enemy: () => data.enemies,
  recipe: () => allRecipeItems,
  factory: () => producible,
};

const COMMAND_STATE: Record<string, (o: any[] | undefined) => string> = {
  operator: (o) => `op|${opt(o, "name")}|o`,
  weapon: (o) => `wp|${opt(o, "name")}`,
  gear: (o) => `gr|${opt(o, "name")}`,
  item: (o) => `it|${opt(o, "name")}`,
  enemy: (o) => `en|${opt(o, "name")}`,
  recipe: (o) => `rc|${opt(o, "name")}`,
  factory: (o) => `fa|${opt(o, "product")}|${opt(o, "rate") ?? 30}`,
  banner: (o) => `bn|${opt(o, "server") ?? "AMEU"}`,
  events: (o) => `ev|${opt(o, "server") ?? "AMEU"}`,
  reset: () => "rs",
  help: () => "hp",
};

const ctxOf = (i: any, shared: boolean): Ctx => ({
  lang: localeToLang(i.locale),
  now: Math.floor(Date.now() / 1000),
  shared,
});

/**
 * "Show everyone": post the card publicly, then remove the private one so only one copy remains.
 * The interaction is acknowledged silently (deferred update) and everything else happens afterwards.
 */
async function publish(env: Env, i: any, components: Component[]) {
  const hook = `https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${i.token}`;
  const payload = JSON.stringify({ flags: FLAG_V2, components, allowed_mentions: { parse: [] } });
  const post = await fetch(`${hook}?wait=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
  if (!post.ok) return; // keep the private card
  const sent: any = await post.json();
  if (sent.flags & FLAG_EPHEMERAL) {
    // Discord made the follow-up private as well: drop it and post as the bot instead (needs access to the channel)
    await fetch(`${hook}/messages/${sent.id}`, { method: "DELETE" });
    if (!i.channel_id) return;
    const viaBot = await discord(env.DISCORD_TOKEN, "POST", `/channels/${i.channel_id}/messages`, JSON.parse(payload));
    if (!viaBot.ok) return;
  }
  await fetch(`${hook}/messages/@original`, { method: "DELETE" });
}

const ackSilently = () => json({ type: InteractionResponseType.DeferredMessageUpdate });

async function publishWiki(env: Env, i: any, query: string) {
  try {
    await publish(env, i, (await wikiCard(query, true, localeToLang(i.locale))).components);
  } catch {
    /* wiki unavailable: the private card stays, the user can press the button again */
  }
}

async function deferWiki(env: Env, i: any, query: string, shared: boolean) {
  let body: { components: Component[] };
  try {
    body = await wikiCard(query, shared, localeToLang(i.locale));
  } catch {
    body = { components: [container(0xed4245, [text(t(localeToLang(i.locale), "wiki_timeout"))])] };
  }
  await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${i.token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flags: FLAG_V2, components: body.components }),
  });
}

/** Discord only hides commands by default permission; server admins can override that, so check here too. */
function canManage(i: any): boolean {
  try {
    const perms = BigInt(i.member?.permissions ?? 0);
    return (perms & 0x20n) !== 0n || (perms & 0x8n) !== 0n; // Manage Server or Administrator
  } catch {
    return false;
  }
}

async function handlePrivacyDelete(env: Env, i: any): Promise<Response> {
  const lang = localeToLang(i.locale);
  if (!i.guild_id) return notice(t(lang, "nt_only_server"));
  if (!canManage(i)) return notice(t(lang, "no_perm"));
  const n = await deleteGuildData(env, i.guild_id);
  return notice(n ? t(lang, "pd_done", { n }) : t(lang, "pd_none"));
}

async function handleNotify(env: Env, i: any): Promise<Response> {
  const lang = localeToLang(i.locale);
  if (!i.guild_id) return notice(t(lang, "nt_only_server"));
  if (!canManage(i)) return notice(t(lang, "no_perm"));
  const sub = i.data.options?.[0];
  const o = sub?.options;
  if (sub?.name === "list") {
    const subs = await list(env, i.guild_id);
    if (!subs.length) return notice(t(lang, "nt_none"));
    const lines = subs.map((s) => {
      const kinds = [s.banners && t(lang, "nt_banners"), s.events && t(lang, "nt_events"), s.resets && t(lang, "nt_resets")].filter(Boolean).join(", ");
      return `<#${s.channel_id}> · ${s.server} · ${s.lang} · ${kinds}${s.role_id ? ` · <@&${s.role_id}>` : ""}${s.failures >= 5 ? ` · **${t(lang, "nt_paused")}**` : ""}`;
    });
    return notice(t(lang, "nt_list") + "\n" + lines.join("\n"));
  }
  if (sub?.name === "unsubscribe") {
    const ok = await unsubscribe(env, i.guild_id, opt(o, "channel"));
    return notice(t(lang, ok ? "nt_unsub_ok" : "nt_unsub_none"));
  }
  // subscribe: language defaults to the server's language, then the user's
  const postLang: Lang = (LANGS as string[]).includes(opt(o, "language")) ? opt(o, "language") : localeToLang(i.guild_locale ?? i.locale);
  // check the bot can post there first
  const channel = opt(o, "channel");
  const test = await discord(env.DISCORD_TOKEN, "POST", `/channels/${channel}/messages`, {
    flags: FLAG_V2,
    components: [container(BRAND_COLOR, [text(t(postLang, "nt_test"))])],
  });
  if (!test.ok) {
    const invite = `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_APP_ID}&scope=bot+applications.commands&permissions=3072`;
    return notice(
      t(lang, "nt_cant_post", { channel, status: test.status }),
      [row(linkButton(t(lang, "nt_add_bot"), invite))],
    );
  }
  const s: Omit<Sub, "id" | "failures"> = {
    guild_id: i.guild_id,
    channel_id: channel,
    server: opt(o, "server"),
    lang: postLang,
    role_id: opt(o, "role") ?? null,
    banners: opt(o, "banners") === false ? 0 : 1,
    events: opt(o, "events") === false ? 0 : 1,
    resets: opt(o, "resets") ? 1 : 0,
  };
  await subscribe(env, s);
  // don't replay things that started before the subscription
  const saved = (await list(env, i.guild_id)).find((x) => x.channel_id === channel);
  if (saved) {
    const now = Math.floor(Date.now() / 1000);
    const stmts = dueFor(saved, now).map((d) =>
      env.DB.prepare("INSERT OR IGNORE INTO sent_log (sub_id, key, sent_at) VALUES (?, ?, ?)").bind(saved.id, d.key, now),
    );
    if (stmts.length) await env.DB.batch(stmts);
  }
  return notice(t(lang, "nt_ok", { channel, server: s.server }));
}

async function handle(request: Request, env: Env, ectx: ExecutionContext): Promise<Response> {
  const body = await request.text();
  const ok = await verifyDiscordRequest(
    body,
    request.headers.get("X-Signature-Ed25519"),
    request.headers.get("X-Signature-Timestamp"),
    env.DISCORD_PUBLIC_KEY,
  );
  if (!ok) return new Response("Bad signature", { status: 401 });
  const i = JSON.parse(body);

  switch (i.type) {
    case InteractionType.Ping:
      return json({ type: InteractionResponseType.Pong });

    case InteractionType.ApplicationCommandAutocomplete: {
      const focused = (i.data.options ?? []).find((o: any) => o.focused);
      const q = String(focused?.value ?? "");
      if (i.data.name === "wiki") {
        const titles = await suggest(q).catch(() => [] as string[]);
        return json({ type: InteractionResponseType.ApplicationCommandAutocompleteResult, data: { choices: titles.slice(0, 25).map((title) => ({ name: title.slice(0, 100), value: title.slice(0, 100) })) } });
      }
      const source = AUTOCOMPLETE_SOURCES[i.data.name];
      return json({ type: InteractionResponseType.ApplicationCommandAutocompleteResult, data: { choices: source ? choices(source(), q, ctxOf(i, false).lang) : [] } });
    }

    case InteractionType.ApplicationCommand: {
      const name = i.data.name;
      if (name === "notify") return handleNotify(env, i);
      if (name === "privacy-delete") return handlePrivacyDelete(env, i);
      if (name === "wiki") {
        ectx.waitUntil(deferWiki(env, i, String(opt(i.data.options, "query") ?? ""), false));
        return json({ type: InteractionResponseType.DeferredChannelMessageWithSource, data: { flags: FLAG_EPHEMERAL } });
      }
      const toState = COMMAND_STATE[name];
      if (!toState) return message(helpView(ctxOf(i, false)).components, true);
      return message(render(toState(i.data.options), ctxOf(i, false)).components, true);
    }

    case InteractionType.MessageComponent: {
      const id: string = i.data.custom_id;
      const shared = !((i.message?.flags ?? 0) & FLAG_EPHEMERAL);
      if (id.startsWith("pub|wk|")) {
        ectx.waitUntil(publishWiki(env, i, id.slice(7)));
        return ackSilently();
      }
      if (id.startsWith("pub|")) {
        ectx.waitUntil(publish(env, i, render(id.slice(4), ctxOf(i, true)).components));
        return ackSilently();
      }
      if (id.startsWith("fam|")) {
        const item = id.slice(4);
        return json({
          type: InteractionResponseType.Modal,
          data: {
            custom_id: `fams|${item}`.slice(0, 100),
            title: t(localeToLang(i.locale), "rate_title"),
            components: [
              row({
                type: ComponentType.TextInput,
                custom_id: "rate",
                label: t(localeToLang(i.locale), "rate_label", { item }).slice(0, 45),
                style: TextInputStyle.Short,
                placeholder: "30",
                required: true,
                max_length: 8,
              }),
            ],
          },
        });
      }
      return update(render(id, ctxOf(i, shared)).components);
    }

    case InteractionType.ModalSubmit: {
      const id: string = i.data.custom_id;
      if (id.startsWith("fams|")) {
        const value = i.data.components?.[0]?.components?.[0]?.value ?? "30";
        const rate = Number(String(value).replace(",", "."));
        const shared = !((i.message?.flags ?? 0) & FLAG_EPHEMERAL);
        return update(render(`fa|${id.slice(5)}|${Number.isFinite(rate) ? rate : 30}`, ctxOf(i, shared)).components);
      }
      return notice(t(localeToLang(i.locale), "nt_unknown_form"));
    }
  }
  return new Response("Unhandled interaction", { status: 400 });
}

export default {
  async fetch(request: Request, env: Env, ectx: ExecutionContext): Promise<Response> {
    if (request.method === "POST") return handle(request, env, ectx);
    const page = legalPage(new URL(request.url).pathname);
    if (page) return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
    return new Response(`Endfield bot · data ${data.syncedAt}`, { headers: { "Content-Type": "text/plain" } });
  },
  async scheduled(_event: ScheduledController, env: Env, ectx: ExecutionContext) {
    ectx.waitUntil(
      (async () => {
        try {
          const result = await syncCommands(env);
          if (result !== "unchanged") console.log("commands:", result);
        } catch (e) {
          console.log("commands sync error", String(e));
        }
        await runCron(env);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
