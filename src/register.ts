// Keeps Discord's slash commands in sync with src/commands.ts without a manual step:
// the cron job compares a hash of the definitions with the one stored in D1 and re-registers on change.
import { COMMANDS } from "./commands.ts";
import { discord } from "./lib/discord.ts";
import type { Env } from "./notify.ts";

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function syncCommands(env: Env): Promise<string> {
  const body = JSON.stringify(COMMANDS);
  const hash = await sha256(body);
  const stored = await env.DB.prepare("SELECT value FROM meta WHERE key = 'commands_hash'").first<{ value: string }>();
  if (stored?.value === hash) return "unchanged";
  const res = await discord(env.DISCORD_TOKEN, "PUT", `/applications/${env.DISCORD_APP_ID}/commands`, COMMANDS);
  if (!res.ok) return `failed ${res.status}: ${(await res.text()).slice(0, 300)}`;
  await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('commands_hash', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1")
    .bind(hash)
    .run();
  return "registered";
}

/**
 * Install counts come only from Discord (the bot has no gateway connection, so it never sees joins/leaves).
 * The cron stores the latest numbers in meta.stats; read them with:
 *   npx wrangler d1 execute endfield-bot --remote --command "SELECT value FROM meta WHERE key='stats'"
 */
export async function syncStats(env: Env): Promise<string> {
  const res = await discord(env.DISCORD_TOKEN, "GET", "/applications/@me");
  if (!res.ok) return `failed ${res.status}`;
  const app: any = await res.json();
  const stats = JSON.stringify({
    servers: app.approximate_guild_count ?? null,
    user_installs: app.approximate_user_install_count ?? null,
    user_authorizations: app.approximate_user_authorization_count ?? null,
    at: new Date().toISOString(),
  });
  await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('stats', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1")
    .bind(stats)
    .run();
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO stats_daily (day, servers, user_installs, user_authorizations) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(day) DO UPDATE SET servers = ?2, user_installs = ?3, user_authorizations = ?4`,
  )
    .bind(day, app.approximate_guild_count ?? null, app.approximate_user_install_count ?? null, app.approximate_user_authorization_count ?? null)
    .run();
  return "ok";
}
