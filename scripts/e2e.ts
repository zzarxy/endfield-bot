// Sends signed fake interactions to a running `wrangler dev` and checks the responses.
import { sign, createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";

const URL = process.env.BOT_URL ?? "http://127.0.0.1:8787/";
const key = createPrivateKey(readFileSync(".dev-key.pem"));

async function send(body: unknown, tamper = false) {
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = sign(null, Buffer.from(timestamp + raw), key).toString("hex");
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature-Ed25519": tamper ? sig.replace(/^./, sig[0] === "a" ? "b" : "a") : sig,
      "X-Signature-Timestamp": timestamp,
    },
    body: raw,
  });
  const text = await res.text();
  return { status: res.status, json: text.startsWith("{") ? JSON.parse(text) : text };
}

const base = { id: "1", application_id: "0", token: "t", version: 1, locale: "ru" };
const cmd = (name: string, options: unknown[] = []) => ({ ...base, type: 2, data: { id: "1", name, type: 1, options } });
let failed = 0;
const check = (label: string, ok: boolean, info?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) { failed++; console.log(JSON.stringify(info).slice(0, 800)); }
};
const texts = (j: any): string => JSON.stringify(j?.data?.components ?? []);

const r1 = await send({ ...base, type: 1 });
check("ping -> pong", r1.json?.type === 1, r1);
const r2 = await send({ ...base, type: 1 }, true);
check("bad signature -> 401", r2.status === 401, r2);
const r3 = await send({ ...base, type: 4, data: { name: "operator", options: [{ name: "name", type: 3, value: "арк", focused: true }] } });
check("autocomplete in Russian", r3.json?.data?.choices?.[0]?.value === "Arclight", r3.json);
const r4 = await send(cmd("operator", [{ name: "name", type: 3, value: "Arclight" }]));
check("operator card", r4.json?.type === 4 && texts(r4.json).includes("Арклайт") && (r4.json.data.flags & 64) === 64, r4.json);
const r5 = await send({ ...base, type: 3, message: { flags: 32768 | 64 }, data: { custom_id: "op|Arclight|s", component_type: 2 } });
check("tab button updates message", r5.json?.type === 7 && texts(r5.json).includes("Battle Skill"), r5.json);
const r6 = await send({ ...base, type: 3, message: { flags: 32768 | 64 }, data: { custom_id: "pub|op|Arclight|s", component_type: 2 } });
check("show everyone -> silent ack (card is re-posted, private one removed)", r6.json?.type === 6, r6.json);
const r7 = await send(cmd("factory", [{ name: "product", type: 3, value: "Ferrium Part" }, { name: "rate", type: 10, value: 60 }]));
check("factory chain", texts(r7.json).includes("Refining Unit"), r7.json);
const r8 = await send({ ...base, type: 3, message: { flags: 32768 | 64 }, data: { custom_id: "fam|Ferrium Part", component_type: 2 } });
check("set rate opens modal", r8.json?.type === 9, r8.json);
const r9 = await send({ ...base, type: 5, message: { flags: 32768 | 64 }, data: { custom_id: "fams|Ferrium Part", components: [{ type: 1, components: [{ type: 4, custom_id: "rate", value: "90" }] }] } });
check("modal submit recalculates", r9.json?.type === 7 && texts(r9.json).includes("90/min"), r9.json);
for (const name of ["banner", "events", "reset", "help"]) {
  const r = await send(cmd(name));
  check(`/${name}`, r.json?.type === 4 && texts(r.json).length > 100, r.json);
}
const r10 = await send(cmd("wiki", [{ name: "query", type: 3, value: "Talos-II" }]));
check("/wiki defers", r10.json?.type === 5, r10.json);
const r11 = await send({ ...base, type: 4, data: { name: "wiki", options: [{ name: "query", type: 3, value: "Talo", focused: true }] } });
check("wiki autocomplete (live)", (r11.json?.data?.choices ?? []).length > 0, r11.json);
const r12 = await send({ ...cmd("notify", [{ name: "list", type: 1, options: [] }]), guild_id: "42" });
check("/notify list (D1)", r12.json?.type === 4 && texts(r12.json).includes("No subscriptions"), r12.json);

console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
