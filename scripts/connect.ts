// One-time Discord hookup: stores the app credentials as Worker secrets, registers slash commands,
// points the app's Interactions Endpoint at the worker and sets install options (server + user install).
// Reads DISCORD_APP_ID, DISCORD_PUBLIC_KEY, DISCORD_TOKEN from the environment (see connect.ps1).
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMMANDS } from "../src/commands.ts";

const WORKER_URL = "https://endfield-bot.endfield-bot.workers.dev/";
const API = "https://discord.com/api/v10";
const { DISCORD_APP_ID: appId, DISCORD_PUBLIC_KEY: publicKey, DISCORD_TOKEN: token } = process.env;

if (!appId || !/^\d{17,20}$/.test(appId)) throw new Error("Application ID must be 17-20 digits");
if (!publicKey || !/^[0-9a-f]{64}$/i.test(publicKey)) throw new Error("Public Key must be 64 hex characters");
if (!token || token.length < 50) throw new Error("Bot token looks wrong");

const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
const step = (s: string) => console.log(`\n== ${s}`);

step("Checking the bot token");
const me = await fetch(`${API}/applications/@me`, { headers });
if (!me.ok) throw new Error(`Token rejected by Discord (${me.status})`);
const app: any = await me.json();
if (app.id !== appId) throw new Error(`Token belongs to app ${app.id}, not ${appId}`);
console.log(`ok: ${app.name}`);

step("Saving Worker secrets");
const dir = mkdtempSync(join(tmpdir(), "efb-"));
const file = join(dir, "secrets.json");
try {
  writeFileSync(file, JSON.stringify({ DISCORD_APP_ID: appId, DISCORD_PUBLIC_KEY: publicKey.toLowerCase(), DISCORD_TOKEN: token }));
  execFileSync("npx", ["wrangler", "secret", "bulk", file], { stdio: "inherit", shell: true, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

step(`Registering ${COMMANDS.length} slash commands`);
const reg = await fetch(`${API}/applications/${appId}/commands`, { method: "PUT", headers, body: JSON.stringify(COMMANDS) });
if (!reg.ok) throw new Error(`Command registration failed: ${reg.status} ${await reg.text()}`);
console.log("ok");

step("Setting Interactions Endpoint URL and install options");
const patch = {
  interactions_endpoint_url: WORKER_URL,
  integration_types_config: {
    "0": { oauth2_install_params: { scopes: ["applications.commands", "bot"], permissions: "3072" } }, // View Channel + Send Messages
    "1": { oauth2_install_params: { scopes: ["applications.commands"], permissions: "0" } },
  },
};
// Discord pings the endpoint with the new key; the secret can take a few seconds to propagate
for (let attempt = 1; ; attempt++) {
  const res = await fetch(`${API}/applications/@me`, { method: "PATCH", headers, body: JSON.stringify(patch) });
  if (res.ok) break;
  const body = await res.text();
  if (attempt >= 6) throw new Error(`Endpoint update failed: ${res.status} ${body}`);
  console.log(`not yet (${res.status}), retrying…`);
  await new Promise((r) => setTimeout(r, 5000));
}
console.log("ok");

console.log(`\nDone. Add the bot to a server:\nhttps://discord.com/oauth2/authorize?client_id=${appId}&scope=bot+applications.commands&permissions=3072`);
console.log(`Or add it to your account (works everywhere):\nhttps://discord.com/oauth2/authorize?client_id=${appId}&integration_type=1&scope=applications.commands`);
