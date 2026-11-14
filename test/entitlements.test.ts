import { describe, expect, it } from "vitest";
import { guildTier, CHANNEL_LIMIT } from "../src/lib/entitlements.ts";
import type { Env } from "../src/notify.ts";

const envWith = (row: { tier: string; expires_at: number | null } | null) =>
  ({ DB: { prepare: () => ({ bind: () => ({ first: async () => row }) }) } }) as unknown as Env;

describe("guildTier", () => {
  it("is free without a row", async () => expect(await guildTier(envWith(null), "1")).toBe("free"));
  it("is server with an active plan", async () => {
    expect(await guildTier(envWith({ tier: "server", expires_at: null }), "1")).toBe("server");
    expect(await guildTier(envWith({ tier: "server", expires_at: 2000 }), "1", 1000)).toBe("server");
  });
  it("falls back to free when the plan expired or the tier is unknown", async () => {
    expect(await guildTier(envWith({ tier: "server", expires_at: 500 }), "1", 1000)).toBe("free");
    expect(await guildTier(envWith({ tier: "gold", expires_at: null }), "1")).toBe("free");
  });
  it("free servers get one channel, paid servers more", () => {
    expect(CHANNEL_LIMIT.free).toBe(1);
    expect(CHANNEL_LIMIT.server).toBeGreaterThan(1);
  });
});
