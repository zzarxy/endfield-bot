// Free vs Supporter limits. The bot only reads the `entitlements` table; paid plans are written by the payment webhook.
import type { Env } from "../notify.ts";

export type Tier = "free" | "server";

/** Notification channels a server may subscribe, by tier. */
export const CHANNEL_LIMIT: Record<Tier, number> = { free: 1, server: 10 };

export async function guildTier(env: Env, guildId: string, now = Math.floor(Date.now() / 1000)): Promise<Tier> {
  const row = await env.DB.prepare("SELECT tier, expires_at FROM entitlements WHERE subject_type = 'guild' AND subject_id = ?")
    .bind(guildId)
    .first<{ tier: string; expires_at: number | null }>();
  if (!row || row.tier !== "server") return "free";
  return row.expires_at === null || row.expires_at > now ? "server" : "free";
}
