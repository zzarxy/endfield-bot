// Builds public/listing.json (texts from docs/listing.md) and public/commands.json (slash commands)
// so bot-list forms can be filled from the browser. Run: npx tsx scripts/listing.ts
import { readFileSync, writeFileSync } from "node:fs";
import { COMMANDS } from "../src/commands.ts";

const md = readFileSync("docs/listing.md", "utf8").replace(/\r\n/g, "\n");
const long = md.split("<!-- BEGIN LONG -->\n")[1].split("\n<!-- END LONG -->")[0];
const short = md.split("## Short description (≤140 chars)\n")[1].split("\n")[0].trim();
const faq = [...md.split("## FAQ")[1].split("\n## ")[0].matchAll(/^\d+\. \*\*(.+?)\*\* — (.+)$/gm)].map((m) => ({ q: m[1], a: m[2] }));
if (short.length > 140) throw new Error(`short description is ${short.length} chars`);
writeFileSync("public/listing.json", JSON.stringify({ short, long, faq }, null, 2));
writeFileSync("public/commands.json", JSON.stringify(COMMANDS));
writeFileSync("public/_headers", "/listing.json\n  Access-Control-Allow-Origin: *\n/commands.json\n  Access-Control-Allow-Origin: *\n");
console.log(`short ${short.length} chars, long ${long.length} chars, faq ${faq.length}, commands ${COMMANDS.length}`);
