// Registers slash commands globally (or in one guild with GUILD_ID for instant updates while testing).
// Needs DISCORD_APP_ID and DISCORD_TOKEN in the environment or in .dev.vars.
import { readFileSync, existsSync } from "node:fs";
import { COMMANDS } from "../src/commands.ts";

const vars: Record<string, string> = {};
if (existsSync(".dev.vars")) {
  for (const line of readFileSync(".dev.vars", "utf8").split(/\r?\n/)) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m) vars[m[1]] = m[2];
  }
}
const appId = process.env.DISCORD_APP_ID ?? vars.DISCORD_APP_ID;
const token = process.env.DISCORD_TOKEN ?? vars.DISCORD_TOKEN;
const guild = process.env.GUILD_ID;
if (!appId || !token || token === "dev") throw new Error("Set DISCORD_APP_ID and DISCORD_TOKEN (real values)");

const path = guild ? `/applications/${appId}/guilds/${guild}/commands` : `/applications/${appId}/commands`;
const res = await fetch(`https://discord.com/api/v10${path}`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(COMMANDS),
});
console.log(res.status, res.ok ? `registered ${COMMANDS.length} commands${guild ? ` in guild ${guild}` : " globally"}` : await res.text());
process.exit(res.ok ? 0 : 1);
