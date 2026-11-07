// Channel subscriptions (/notify) and the cron job that posts banner/event/reset notifications.
import { data, server, span, localName } from "./data/index.ts";
import { t, type Lang, type Key } from "./i18n.ts";
import { nextDailyReset } from "./lib/time.ts";
import { BRAND_COLOR, RARITY_COLOR, container, fileUrl, footer, section, separator, text, ts, FLAG_V2, type Component } from "./lib/ui.ts";
import { discord } from "./lib/discord.ts";
import type { Server, TimedEntry } from "./data/types.ts";

export interface Env {
  DB: D1Database;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APP_ID: string;
  DISCORD_TOKEN: string;
}

export interface Sub {
  id: number;
  guild_id: string;
  channel_id: string;
  server: Server["id"];
  lang: Lang;
  role_id: string | null;
  banners: number;
  events: number;
  resets: number;
  failures: number;
}

const LOOKBACK = 6 * 3600; // posts missed by a failed/limited run are still sent within 6h
const MAX_POSTS_PER_RUN = 40; // stays under the free plan's 50 subrequests per invocation
const RESET_REMINDER = 3600; // remind 1h before daily reset

export async function subscribe(env: Env, s: Omit<Sub, "id" | "failures">) {
  await env.DB.prepare(
    `INSERT INTO subscriptions (guild_id, channel_id, server, lang, role_id, banners, events, resets, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(channel_id) DO UPDATE SET server = ?3, lang = ?4, role_id = ?5, banners = ?6, events = ?7, resets = ?8, failures = 0`,
  )
    .bind(s.guild_id, s.channel_id, s.server, s.lang, s.role_id, s.banners, s.events, s.resets, Math.floor(Date.now() / 1000))
    .run();
}

export async function unsubscribe(env: Env, guildId: string, channelId: string) {
  const r = await env.DB.prepare("DELETE FROM subscriptions WHERE guild_id = ? AND channel_id = ?").bind(guildId, channelId).run();
  return r.meta.changes > 0;
}

export async function list(env: Env, guildId: string): Promise<Sub[]> {
  const r = await env.DB.prepare("SELECT * FROM subscriptions WHERE guild_id = ?").bind(guildId).all<Sub>();
  return r.results;
}

/** A notification that is due: key is stable so it is sent once per subscription. */
interface Due { key: string; at: number; components: Component[] }

function entryCard(e: TimedEntry, srv: Server["id"], title: string, lang: Lang): Component[] {
  const sp = span(e, srv)!;
  const op = e.rateUp ? data.operators.find((o) => o.name === e.rateUp) : undefined;
  let s = `### ${title}\n**${e.name}**`;
  if (e.rateUp) s += ` — ${t(lang, "rate_up")} **${localName(e.rateUp, lang)}**`;
  if (e.type) s += ` · ${e.type}`;
  s += `\n${ts(sp.start)} → ${ts(sp.end)} (${t(lang, "ends")} ${ts(sp.end, "R")})`;
  return [
    container(op ? RARITY_COLOR[op.rarity] : BRAND_COLOR, [
      section(s, fileUrl(op?.icon ?? e.image)),
      separator(),
      footer(data.syncedAt, lang),
    ]),
  ];
}

export function dueFor(sub: Sub, now: number): Due[] {
  const out: Due[] = [];
  const srv = sub.server;
  const lang = sub.lang ?? "en";
  const card = (e: TimedEntry, key: Key) => entryCard(e, srv, t(lang, key), lang);
  for (const e of data.timeline) {
    const sp = span(e, srv);
    if (!sp) continue;
    const fresh = (t: number) => t <= now && t > now - LOOKBACK;
    if (e.kind === "banner" && sub.banners) {
      if (fresh(sp.start)) out.push({ key: `b:${e.name}:start`, at: sp.start, components: card(e, "nt_new_banner") });
      if (e.rateUp && fresh(sp.end - 86400)) out.push({ key: `b:${e.name}:last`, at: sp.end - 86400, components: card(e, "nt_last_day") });
    }
    if (e.kind === "event" && sub.events && fresh(sp.start)) {
      out.push({ key: `e:${e.name}:start`, at: sp.start, components: card(e, "nt_new_event") });
    }
    if (e.kind === "version" && (sub.events || sub.banners) && fresh(sp.start)) {
      out.push({ key: `v:${e.name}`, at: sp.start, components: card(e, "nt_new_version") });
    }
  }
  if (sub.resets) {
    const reset = nextDailyReset(server(srv), now);
    const remindAt = reset - RESET_REMINDER;
    if (remindAt <= now) {
      out.push({
        key: `r:${reset}`,
        at: remindAt,
        components: [container(BRAND_COLOR, [text(`### ${t(lang, "nt_reset_title", { when: ts(reset, "R") })}\n${t(lang, "nt_reset_body", { server: t(lang, srv === "ASIA" ? "server_asia" : "server_ameu") })}`)])],
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export async function runCron(env: Env, now = Math.floor(Date.now() / 1000)) {
  const subs = (await env.DB.prepare("SELECT * FROM subscriptions WHERE failures < 5").all<Sub>()).results;
  let posts = 0;
  for (const sub of subs) {
    const due = dueFor(sub, now);
    if (!due.length) continue;
    const sent = new Set(
      (await env.DB.prepare("SELECT key FROM sent_log WHERE sub_id = ?").bind(sub.id).all<{ key: string }>()).results.map((r) => r.key),
    );
    for (const d of due) {
      if (sent.has(d.key)) continue;
      if (posts >= MAX_POSTS_PER_RUN) return; // next run continues (LOOKBACK window)
      posts++;
      const comps = sub.role_id ? [text(`<@&${sub.role_id}>`), ...d.components] : d.components;
      const res = await discord(env.DISCORD_TOKEN, "POST", `/channels/${sub.channel_id}/messages`, {
        flags: FLAG_V2,
        components: comps,
        allowed_mentions: { roles: sub.role_id ? [sub.role_id] : [] },
      });
      if (res.ok) {
        await env.DB.prepare("INSERT OR IGNORE INTO sent_log (sub_id, key, sent_at) VALUES (?, ?, ?)").bind(sub.id, d.key, now).run();
      } else if (res.status === 403 || res.status === 404) {
        // lost access to the channel: back off, disable after 5 failures
        await env.DB.prepare("UPDATE subscriptions SET failures = failures + 1 WHERE id = ?").bind(sub.id).run();
        break;
      }
    }
  }
  // keep the log small
  await env.DB.prepare("DELETE FROM sent_log WHERE sent_at < ?").bind(now - 30 * 86400).run();
}
