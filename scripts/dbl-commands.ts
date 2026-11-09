// Sends the slash command list to discordbotlist.com so it shows on the bot page.
// Needs DBL_TOKEN (the bot's API token from discordbotlist.com); run via scripts/dbl-commands.ps1.
import { COMMANDS } from "../src/commands.ts";

const token = process.env.DBL_TOKEN;
const appId = process.env.DISCORD_APP_ID ?? "1568475342174162947";
if (!token || token.length < 20) throw new Error("Set DBL_TOKEN (discordbotlist.com API token)");

const res = await fetch(`https://discordbotlist.com/api/v1/bots/${appId}/commands`, {
  method: "POST",
  headers: { Authorization: token.startsWith("Bot ") ? token : `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(COMMANDS),
});
console.log(res.status, res.ok ? `sent ${COMMANDS.length} commands` : (await res.text()).slice(0, 300));
process.exit(res.ok ? 0 : 1);
