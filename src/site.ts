// Landing page served at GET / (the bot's "Website" link on bot lists). POST / stays the interactions endpoint.
import { SUPPORT_URL } from "./lib/links.ts";

const APP_ID = "1568475342174162947";
const ADD_SERVER = `https://discord.com/oauth2/authorize?client_id=${APP_ID}&scope=bot+applications.commands&permissions=3072`;
const ADD_USER = `https://discord.com/oauth2/authorize?client_id=${APP_ID}&integration_type=1&scope=applications.commands`;

const FEATURES: [string, string, string][] = [
  ["Operator cards", "Kit, skills with level 1 → max scaling, talents, potentials and every promotion and skill material — with the operator art.", "/img/operator.png"],
  ["AIC factory planner", "Type a product and a rate. Get the whole production chain: machines, raw input per minute, power and byproducts.", "/img/factory.png"],
  ["Banners, events, resets", "Current and upcoming headhunting banners, events and daily/weekly resets, always shown in your own timezone.", "/img/banner.png"],
  ["Your language", "Interface in 8 languages. Operator, item and weapon names are searchable in English, Russian, Spanish, Japanese, Korean and Chinese.", "/img/operator-ja.png"],
];

export function landingPage(): string {
  const cards = FEATURES.map(
    ([title, text, img]) => `<section class="feat"><div><h2>${title}</h2><p>${text}</p></div><img src="${img}" alt="${title}"></section>`,
  ).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Endfield Helper · Arknights: Endfield Discord bot</title>
<meta name="description" content="Free Discord bot for Arknights: Endfield: operator, weapon, gear and item cards, AIC factory planner, banner and reset timers in 8 languages.">
<meta property="og:title" content="Endfield Helper"><meta property="og:description" content="Arknights: Endfield wiki, AIC factory planner and banner timers inside Discord.">
<meta property="og:image" content="/img/operator.png"><link rel="icon" href="/img/avatar.png">
<style>
:root{color-scheme:dark;--bg:#0f1115;--card:#171a21;--line:#262a33;--text:#e7e9ee;--muted:#9aa1ad;--accent:#fff200}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,"Segoe UI",sans-serif}
a{color:inherit}.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
header{padding:64px 0 40px;text-align:center}
header img{width:96px;height:96px;border-radius:24px;box-shadow:0 0 0 1px var(--line)}
h1{font-size:44px;line-height:1.1;margin:18px 0 10px;letter-spacing:-.02em}
.tag{color:var(--muted);font-size:19px;max-width:640px;margin:0 auto}
.cta{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:28px}
.btn{display:inline-block;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;border:1px solid var(--line)}
.btn.main{background:var(--accent);color:#111;border-color:var(--accent)}.btn:hover{filter:brightness(1.08)}
.note{color:var(--muted);font-size:14px;margin-top:12px}
.feat{display:grid;grid-template-columns:1fr 1.1fr;gap:36px;align-items:center;padding:40px 0;border-top:1px solid var(--line)}
.feat:nth-child(even){grid-template-columns:1.1fr 1fr}.feat:nth-child(even) div{order:2}
.feat h2{font-size:26px;margin:0 0 8px}.feat p{color:var(--muted);margin:0}
.feat img{width:100%;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.45)}
.langs{border-top:1px solid var(--line);padding:40px 0;text-align:center;color:var(--muted)}
.langs b{color:var(--text)}
footer{border-top:1px solid var(--line);padding:28px 0 48px;color:var(--muted);font-size:14px;text-align:center}
footer a{margin:0 10px}
@media(max-width:760px){.feat,.feat:nth-child(even){grid-template-columns:1fr}.feat:nth-child(even) div{order:0}h1{font-size:34px}}
</style></head><body>
<div class="wrap">
<header>
  <img src="/img/avatar.png" alt="Endfield Helper">
  <h1>Endfield Helper</h1>
  <p class="tag">The Arknights: Endfield wiki, an AIC factory planner and banner timers — right inside Discord.</p>
  <div class="cta">
    <a class="btn main" href="${ADD_SERVER}">Add to server</a>
    <a class="btn" href="${ADD_USER}">Add to my account</a>
    <a class="btn" href="${SUPPORT_URL}">Support server</a>
  </div>
  <p class="note">Free · works in any server or DM as a personal app · replies are private until you share them</p>
</header>
${cards}
<div class="langs"><b>English · Русский · Українська · Español · 日本語 · 한국어 · 简体中文 · 繁體中文</b><br>The bot follows your Discord language automatically.</div>
<footer>
  <a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a><a href="${SUPPORT_URL}">Support</a><br><br>
  Unofficial fan-made tool, not affiliated with GRYPHLINE or Hypergryph. Game data from the
  <a href="https://endfield.wiki.gg" style="margin:0">Endfield Talos Wiki</a> (CC BY-SA 4.0).
</footer>
</div></body></html>`;
}
