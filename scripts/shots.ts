// Renders real bot responses (src/views.ts) into Discord-styled HTML pages for listing screenshots.
// Output: docs/shots/<name>.html. The look follows Discord's dark theme; the content is exactly what the bot sends.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { render, type Ctx } from "../src/views.ts";
import type { Lang } from "../src/i18n.ts";

const OUT = "docs/shots";
const now = Math.floor(Date.now() / 1000);
const avatar = "data:image/jpeg;base64," + readFileSync("assets/avatar.jpg").toString("base64");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function relTime(t: number, lang: Lang): string {
  const diff = t - now;
  const rtf = new Intl.RelativeTimeFormat(lang === "tc" ? "zh-TW" : lang === "zh" ? "zh-CN" : lang, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

function stamp(t: number, style: string, lang: Lang): string {
  const loc = lang === "tc" ? "zh-TW" : lang === "zh" ? "zh-CN" : lang === "en" ? "en-US" : lang;
  const d = new Date(t * 1000);
  if (style === "R") return relTime(t, lang);
  if (style === "t") return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  if (style === "d") return d.toLocaleDateString(loc);
  return d.toLocaleString(loc, { dateStyle: "long", timeStyle: "short" });
}

function inline(s: string, lang: Lang): string {
  let h = esc(s);
  h = h.replace(/&lt;t:(\d+):?([RtTdDfF])?&gt;/g, (_, t, st) => `<span class="ts">${stamp(Number(t), st ?? "f", lang)}</span>`);
  h = h.replace(/&lt;#\d+&gt;/g, '<span class="mention">#notifications</span>');
  h = h.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a>$1</a>');
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  h = h.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  return h;
}

function markdown(md: string, lang: Lang): string {
  const out: string[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      out.push(`<pre>${esc(code.join("\n"))}</pre>`);
      continue;
    }
    if (l.startsWith("### ")) out.push(`<h3>${inline(l.slice(4), lang)}</h3>`);
    else if (l.startsWith("## ")) out.push(`<h2>${inline(l.slice(3), lang)}</h2>`);
    else if (l.startsWith("# ")) out.push(`<h1>${inline(l.slice(2), lang)}</h1>`);
    else if (l.startsWith("-# ")) out.push(`<div class="sub">${inline(l.slice(3), lang)}</div>`);
    else if (l.startsWith("> ")) out.push(`<blockquote>${inline(l.slice(2), lang)}</blockquote>`);
    else if (l.trim() === "") out.push('<div class="gap"></div>');
    else out.push(`<div>${inline(l, lang)}</div>`);
  }
  return out.join("");
}

const BTN = { 1: "primary", 2: "secondary", 3: "success", 4: "danger", 5: "link" } as Record<number, string>;

function comp(c: any, lang: Lang): string {
  switch (c.type) {
    case 17: {
      const accent = c.accent_color != null ? `#${c.accent_color.toString(16).padStart(6, "0")}` : "transparent";
      return `<div class="container" style="border-left-color:${accent}">${c.components.map((x: any) => comp(x, lang)).join("")}</div>`;
    }
    case 10: return `<div class="text">${markdown(c.content, lang)}</div>`;
    case 9: return `<div class="section"><div class="stext">${c.components.map((x: any) => comp(x, lang)).join("")}</div><img class="thumb" src="${c.accessory.media.url}"></div>`;
    case 11: return `<img class="thumb" src="${c.media.url}">`;
    case 12: return `<div class="gallery">${c.items.map((it: any) => `<img src="${it.media.url}">`).join("")}</div>`;
    case 14: return `<div class="sep ${c.spacing === 2 ? "big" : ""} ${c.divider === false ? "nodiv" : ""}"></div>`;
    case 1: return `<div class="row">${c.components.map((x: any) => comp(x, lang)).join("")}</div>`;
    case 2: {
      const ext = c.style === 5 ? ' <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M15 2a1 1 0 0 0 0 2h3.6l-7.3 7.3a1 1 0 0 0 1.4 1.4L20 5.4V9a1 1 0 0 0 2 0V3a1 1 0 0 0-1-1h-6ZM5 5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-5a1 1 0 0 0-2 0v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5a1 1 0 0 0 0-2H5Z"/></svg>' : "";
      return `<button class="btn ${BTN[c.style] ?? "secondary"} ${c.disabled ? "disabled" : ""}">${esc(c.label ?? "")}${ext}</button>`;
    }
    default: return "";
  }
}

const CSS = `
*{box-sizing:border-box} body{margin:0;background:#313338;font:16px/1.375 "gg sans","Segoe UI","Noto Sans","Noto Sans JP","Noto Sans KR","Noto Sans SC","Microsoft YaHei","Meiryo",sans-serif;color:#dbdee1}
.msg{width:640px;padding:16px 16px 18px 72px;position:relative}
.cmdline{position:relative;font-size:14px;color:#b5bac1;margin:0 0 4px -2px;display:flex;align-items:center;gap:6px}
.cmdline .u{color:#c9cdfb;font-weight:500}.cmdline .slash{color:#00a8fc}
.cmdline:before{content:"";position:absolute;left:-36px;top:9px;width:30px;height:12px;border-left:2px solid #4e5058;border-top:2px solid #4e5058;border-top-left-radius:6px}
.av{position:absolute;left:16px;top:36px;width:40px;height:40px;border-radius:50%}
.head{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.name{color:#fff;font-weight:600}.app{background:#5865f2;color:#fff;font-size:10px;font-weight:700;padding:1px 4px;border-radius:3px;line-height:15px}
.time{color:#949ba4;font-size:12px}
.container{background:#2b2d31;border:1px solid #3f4147;border-left:4px solid;border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:8px;max-width:560px}
.text h1{font-size:24px;margin:0;color:#f2f3f5}.text h2{font-size:20px;margin:0;color:#f2f3f5}.text h3{font-size:16px;margin:6px 0 0;color:#f2f3f5}
.text .sub{font-size:13px;color:#949ba4}.text .gap{height:8px}
.text blockquote{margin:2px 0;border-left:4px solid #4e5058;padding-left:10px;color:#dbdee1}
.text code{background:#1e1f22;border-radius:4px;padding:0 3px;font-size:14px;font-family:Consolas,monospace}
.text pre{background:#1e1f22;border:1px solid #1e1f22;border-radius:4px;padding:8px;margin:4px 0;font:13px/1.35 Consolas,"Cascadia Mono",monospace;white-space:pre;overflow:hidden;color:#dbdee1}
.text a{color:#00a8fc}.ts{background:rgba(78,80,88,.48);border-radius:3px;padding:0 2px}.mention{background:rgba(88,101,242,.3);color:#c9cdfb;border-radius:3px;padding:0 2px}
.section{display:flex;gap:12px;align-items:flex-start}.stext{flex:1}.thumb{width:85px;height:85px;object-fit:cover;border-radius:8px}
.gallery img{width:100%;border-radius:8px;display:block}
.sep{height:1px;background:#3f4147;margin:4px 0}.sep.big{margin:10px 0}.sep.nodiv{background:transparent}
.row{display:flex;flex-wrap:wrap;gap:8px}
.btn{border:0;border-radius:8px;padding:0 16px;height:32px;font:500 14px "gg sans","Segoe UI",sans-serif;color:#fff;display:inline-flex;align-items:center;gap:6px}
.primary{background:#5865f2}.secondary,.link{background:#4e5058}.success{background:#248046}.danger{background:#da373c}.disabled{opacity:.5}
.eph{margin-top:6px;font-size:12px;color:#949ba4;display:flex;align-items:center;gap:4px}.eph a{color:#00a8fc}
`;

interface Shot { name: string; state: string; lang: Lang; command: string; ephemeral?: boolean }

const shots: Shot[] = [
  { name: "operator", state: "op|Laevatain|o", lang: "en", command: "/operator name: Laevatain" },
  { name: "operator-skills", state: "op|Laevatain|s", lang: "en", command: "/operator name: Laevatain" },
  { name: "factory", state: "fa|SC Wuling Battery|6", lang: "en", command: "/factory product: SC Wuling Battery rate: 6" },
  { name: "banner", state: "bn|AMEU", lang: "en", command: "/banner" },
  { name: "reset", state: "rs", lang: "en", command: "/reset" },
  { name: "operator-ja", state: "op|Laevatain|o", lang: "ja", command: "/operator name: Laevatain" },
  { name: "factory-ru", state: "fa|SC Wuling Battery|6", lang: "ru", command: "/factory product: SC Wuling Battery rate: 6" },
];

mkdirSync(OUT, { recursive: true });
for (const s of shots) {
  const ctx: Ctx = { lang: s.lang, now, shared: true }; // shared: the "Show everyone" button is not part of the shot
  const r = render(s.state, ctx);
  const [cmd, ...args] = s.command.split(" ");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div class="msg" id="shot">
  <div class="cmdline"><img src="${avatar}" style="width:16px;height:16px;border-radius:50%"><span class="u">player</span> used <span class="slash">${esc(cmd)}</span> <span>${esc(args.join(" "))}</span></div>
  <img class="av" src="${avatar}">
  <div class="head"><span class="name">Endfield Helper</span><span class="app">APP</span><span class="time">Today at 12:00</span></div>
  ${r.components.map((c) => comp(c, s.lang)).join("")}
</div></body></html>`;
  writeFileSync(`${OUT}/${s.name}.html`, html);
  console.log(`${OUT}/${s.name}.html`);
}
