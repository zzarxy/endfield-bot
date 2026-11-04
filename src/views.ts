// Every screen the bot can show. A view is addressed by a compact state string
// ("op|Arclight|s") that is also used as the button custom_id, so buttons are stateless.
import { ButtonStyle } from "discord-api-types/v10";
import { data, factory, server, span, timeline, itemByName } from "./data/index.ts";
import { findExact } from "./lib/search.ts";
import { renderTree, fmtRate } from "./lib/factory.ts";
import { nextDailyReset, nextWeeklyReset } from "./lib/time.ts";
import {
  BRAND_COLOR, RARITY_COLOR, button, clip, container, fileUrl, fmtMats, footer, linkButton, row, section,
  separator, stars, text, ts, wikiUrl, type Component,
} from "./lib/ui.ts";
import type { Server } from "./data/types.ts";

export interface Ctx {
  ru: boolean;
  now: number; // unix seconds
  shared: boolean; // already public: no "show everyone" button
}

export interface Rendered { components: Component[] }

const SEP = "|";
export const stateId = (...parts: (string | number)[]) => parts.join(SEP);

const titleOf = (name: string, ru: string | undefined, ctx: Ctx) =>
  ctx.ru && ru && ru !== name ? `${name} · ${ru}` : name;

function frame(accent: number, body: Component[], state: string, ctx: Ctx, wikiPage?: string, extraRows: Component[] = []) {
  const actions: Component[] = [];
  if (wikiPage) actions.push(linkButton("Wiki", wikiUrl(wikiPage)));
  if (!ctx.shared) actions.push(button("Show everyone", `pub${SEP}${state}`, { style: ButtonStyle.Success }));
  const inner = [...body, ...extraRows, separator(), footer(data.syncedAt)];
  if (actions.length) inner.push(row(...actions));
  return { components: [container(accent, inner)] };
}

const notFound = (what: string, q: string): Rendered => ({
  components: [container(0xed4245, [text(`Nothing found for **${q}** in ${what}. Try the autocomplete suggestions.`)])],
});

// ---------------- operator ----------------
const OP_TABS: [string, string][] = [["o", "Overview"], ["s", "Skills"], ["t", "Talents"], ["m", "Materials"]];

function operatorView(name: string, tab: string, ctx: Ctx): Rendered {
  const op = findExact(data.operators, name);
  if (!op) return notFound("operators", name);
  const state = stateId("op", op.name, tab);
  const head = `## ${titleOf(op.name, op.ru, ctx)}\n${stars(op.rarity)} · ${op.element} ${op.class} · ${op.weapon}\n-# ${op.faction}`;
  const body: Component[] = [section(head, fileUrl(op.icon)), separator()];

  if (tab === "s") {
    let s = "";
    for (const sk of op.skills) {
      s += `### ${sk.type}: ${sk.name}\n${clip(sk.desc, 600)}\n`;
      const key = sk.stats.filter((x) => x.lv1 !== x.max).slice(0, 3);
      if (key.length) s += key.map((x) => `-# ${x.name}: ${x.lv1} → ${x.max}`).join("\n") + "\n";
    }
    body.push(text(clip(s || "Skill data is not on the wiki yet.", 3000)));
  } else if (tab === "t") {
    let s = "";
    for (const t of op.talents) {
      s += `### ${t.name}\n` + t.levels.map((l) => `**${l.cond || "—"}:** ${l.desc}`).join("\n") + "\n";
    }
    if (op.potentials.length) {
      s += "### Potentials\n" + op.potentials.map((p) => `**P${p.n} ${p.title}:** ${p.desc}`).join("\n");
    }
    body.push(text(clip(s || "No talent data yet.", 3000)));
  } else if (tab === "m") {
    let s = "### Promotion\n" + op.promotions.map((p) => `**E${p.stage}:** ${fmtMats(p.mats)}`).join("\n");
    if (op.skillLevelMats.length) s += `\n### Skill Lv 1→9 (shared)\n${fmtMats(op.skillLevelMats)}`;
    if (op.masteryMats.length) s += `\n### Skill Lv 9→12 (per skill)\n${fmtMats(op.masteryMats)}`;
    body.push(text(clip(s, 3000)));
  } else {
    let s = op.summary ? `${clip(op.summary, 700)}\n\n` : "";
    s += `**Main:** ${op.main} · **Sub:** ${op.sub}\n`;
    if (op.tags.length) s += `**Tags:** ${op.tags.join(", ")}\n`;
    const st = op.maxStats;
    if (st.HP) s += `**Max stats:** HP ${st.HP} · ATK ${st.ATK} · STR ${st.STR} · AGL ${st.AGL} · INT ${st.INT} · WIL ${st.WIL}\n`;
    if (op.synergy.length) s += `**Recommended weapons & gear (wiki):** ${op.synergy.join(", ")}\n`;
    if (op.quote) s += `\n> *${clip(op.quote, 300)}*`;
    body.push(text(s));
  }
  const tabs = row(...OP_TABS.map(([k, label]) => button(label, stateId("op", op.name, k), { active: k === tab })));
  return frame(RARITY_COLOR[op.rarity] ?? BRAND_COLOR, body, state, ctx, op.name, [separator(), tabs]);
}

// ---------------- weapon ----------------
function weaponView(name: string, ctx: Ctx): Rendered {
  const w = findExact(data.weapons, name);
  if (!w) return notFound("weapons", name);
  let s = `## ${titleOf(w.name, w.ru, ctx)}\n${stars(w.rarity)} · ${w.type}`;
  const body: Component[] = [section(s, fileUrl(w.icon)), separator()];
  s = "";
  if (w.baseAtk) s += `**Base ATK:** ${w.baseAtk}\n`;
  if (w.skills.length) s += `**Skills:** ${w.skills.join(" · ")}\n`;
  if (w.potential) s += `**Potential:** ${w.potential}\n`;
  if (w.source) s += `**Source:** ${w.source}\n`;
  if (w.ascension.length) s += "### Ascension\n" + w.ascension.map((a) => `**${a.stage}:** ${fmtMats(a.mats)}`).join("\n");
  const users = data.operators.filter((o) => o.synergy.includes(w.name)).map((o) => o.name);
  if (users.length) s += `\n**Recommended for:** ${users.join(", ")}`;
  body.push(text(clip(s, 3000)));
  return frame(RARITY_COLOR[w.rarity] ?? BRAND_COLOR, body, stateId("wp", w.name), ctx, w.name);
}

// ---------------- gear / set ----------------
function setView(name: string, ctx: Ctx): Rendered {
  const set = findExact(data.sets, name);
  const piece = set ? undefined : findExact(data.gear, name);
  const target = set ?? (piece?.set ? data.sets.find((x) => x.name === piece.set) : undefined);
  if (!target && !piece) return notFound("gear", name);
  const body: Component[] = [];
  if (piece) {
    let s = `## ${titleOf(piece.name, piece.ru, ctx)}\n${stars(piece.rarity)} · ${piece.type} · Lv ${piece.level}`;
    body.push(section(s, fileUrl(piece.icon)), separator());
    s = piece.defense ? `**DEF:** ${piece.defense}\n` : "";
    s += piece.stats.map((x) => `**${x.stat}:** ${x.values.join(" / ")}`).join("\n");
    if (piece.source) s += `\n**Source:** ${piece.source}`;
    body.push(text(s || "No stats on the wiki yet."));
  }
  if (target) {
    if (piece) body.push(separator());
    body.push(
      section(`### Set: ${titleOf(target.name, target.ru, ctx)} (Lv ${target.level})\n${clip(target.effect, 1200)}`, piece ? undefined : fileUrl(target.icon)),
    );
    if (target.pieces.length) body.push(text(`-# Pieces: ${target.pieces.join(", ")}`));
  }
  return frame(RARITY_COLOR[piece?.rarity ?? 5] ?? BRAND_COLOR, body, stateId("gr", piece?.name ?? target!.name), ctx, piece?.name ?? target!.name);
}

// ---------------- item ----------------
function itemView(name: string, ctx: Ctx): Rendered {
  const it = findExact(data.items, name);
  if (!it) return notFound("items", name);
  const body: Component[] = [section(`## ${titleOf(it.name, it.ru, ctx)}\n${stars(it.rarity)} · ${it.type}`, fileUrl(it.icon)), separator()];
  let s = "";
  if (it.desc) s += `${clip(it.desc, 600)}\n`;
  if (it.use) s += `**Use / obtain:** ${clip(it.use, 600)}\n`;
  const made = data.recipes.filter((r) => r.products.some((p) => p.item === it.name));
  const used = data.recipes.filter((r) => r.ingredients.some((p) => p.item === it.name));
  if (made.length) s += `**Made in:** ${[...new Set(made.map((r) => r.facility))].join(", ")}\n`;
  if (used.length) {
    const outs = [...new Set(used.flatMap((r) => r.products.map((p) => p.item)))];
    s += `**Used for:** ${clip(outs.join(", "), 700)}\n`;
  }
  body.push(text(s || "No description on the wiki yet."));
  const extra: Component[] = [];
  if (made.length) {
    const btns = [button("Recipes", stateId("rc", it.name))];
    if (factory.producible(it.name)) btns.push(button("Production chain", stateId("fa", it.name, 30)));
    extra.push(row(...btns));
  }
  return frame(RARITY_COLOR[it.rarity] ?? BRAND_COLOR, body, stateId("it", it.name), ctx, it.name, extra);
}

// ---------------- enemy ----------------
function enemyView(name: string, ctx: Ctx): Rendered {
  const e = findExact(data.enemies, name);
  if (!e) return notFound("enemies", name);
  const head = `## ${titleOf(e.name, e.ru, ctx)}\n${e.type} · ${e.class}`;
  const body: Component[] = [section(head, fileUrl(e.image)), separator(), text(clip(e.summary || "No description on the wiki yet.", 1500))];
  return frame(e.class === "Boss" ? 0xed4245 : e.class === "Elite" ? 0xff7a1a : 0x95a5a6, body, stateId("en", e.name), ctx, e.name);
}

// ---------------- recipes ----------------
function recipeView(name: string, ctx: Ctx): Rendered {
  const it = findExact(data.items, name) ?? { name, ru: undefined, rarity: 0 };
  const made = data.recipes.filter((r) => r.products.some((p) => p.item === it.name));
  if (!made.length) return notFound("recipes", name);
  let s = "";
  for (const r of made.slice(0, 8)) {
    const time = r.time ? ` · ${r.time}s` : "";
    s += `**${r.facility}**${time}${r.mode ? ` · ${r.mode}` : ""}\n${fmtMats(r.ingredients)} → ${fmtMats(r.products)}\n`;
  }
  if (made.length > 8) s += `-# …and ${made.length - 8} more on the wiki`;
  const body: Component[] = [section(`## Recipes: ${titleOf(it.name, it.ru, ctx)}`, fileUrl(itemByName.get(it.name)?.icon)), separator(), text(s)];
  const extra = factory.producible(it.name) ? [row(button("Production chain (30/min)", stateId("fa", it.name, 30)))] : [];
  return frame(BRAND_COLOR, body, stateId("rc", it.name), ctx, it.name, extra);
}

// ---------------- factory ----------------
export function factoryView(name: string, rate: number, ctx: Ctx): Rendered {
  const target = findExact(
    factory.items().map((n) => ({ name: n, ru: itemByName.get(n)?.ru })),
    name,
  );
  if (!target) return notFound("AIC recipes", name);
  rate = Math.min(Math.max(rate || 30, 0.1), 10000);
  const res = factory.solve(target.name, rate);
  const machines = [...res.machines].map(([f, n]) => `${f} ×${n}`).join(", ");
  const raws = [...res.raw].map(([i, r]) => `${i} ${fmtRate(r)}/min`).join(", ");
  const byp = collectByproducts(res.root);
  let s = `**Machines:** ${machines}\n**Raw input:** ${raws}\n`;
  s += `**Power:** ${res.power}${res.unknownPower.length ? ` (+ unknown for ${res.unknownPower.join(", ")})` : ""}\n`;
  if (byp.length) s += `**Byproducts:** ${byp.join(", ")}\n`;
  const tree = clip(renderTree(res.root), 2200);
  const body: Component[] = [
    section(`## ${titleOf(target.name, target.ru, ctx)} — ${fmtRate(rate)}/min`, fileUrl(itemByName.get(target.name)?.icon)),
    separator(),
    text(s),
    text("```\n" + tree + "```"),
    text("-# Machine counts are fractional in the tree and rounded up in the totals."),
  ];
  const controls = row(
    button("÷2", stateId("fa", target.name, rate / 2)),
    button("×2", stateId("fa", target.name, rate * 2)),
    button("Set rate…", stateId("fam", target.name)),
  );
  return frame(BRAND_COLOR, body, stateId("fa", target.name, rate), ctx, target.name, [controls]);
}

function collectByproducts(node: import("./lib/factory.ts").ChainNode, acc = new Map<string, number>()): string[] {
  for (const b of node.byproducts) acc.set(b.item, (acc.get(b.item) ?? 0) + b.rate);
  node.inputs.forEach((c) => collectByproducts(c, acc));
  return [...acc].map(([i, r]) => `${i} ${fmtRate(r)}/min`);
}

// ---------------- timeline ----------------
const SERVER_TABS: [Server["id"], string][] = [["AMEU", "Americas / Europe"], ["ASIA", "Asia"]];
const serverRow = (view: string, srv: string) =>
  row(...SERVER_TABS.map(([id, label]) => button(label, stateId(view, id), { active: id === srv })));

const PITY = [
  "-# Pity (community data, verify in-game): base 6★ rate 0.8%, soft pity from ~65,",
  "-# 6★ guaranteed by 80 (carries over between banners), featured operator guaranteed at 120 on limited banners (does not carry over).",
].join("\n");

function bannerView(srv: Server["id"], ctx: Ctx): Rendered {
  const { active, upcoming } = timeline("banner", srv, ctx.now);
  const line = (e: (typeof active)[number], future: boolean) => {
    const sp = span(e, srv)!;
    const who = e.rateUp ? ` — rate-up **${e.rateUp}**` : "";
    return future ? `**${e.name}**${who}\nstarts ${ts(sp.start, "R")} (${ts(sp.start)})` : `**${e.name}**${who}\nends ${ts(sp.end, "R")} (${ts(sp.end)})`;
  };
  let s = "### Active\n" + (active.map((e) => line(e, false)).join("\n") || "none");
  if (upcoming.length) s += "\n### Upcoming\n" + upcoming.slice(0, 4).map((e) => line(e, true)).join("\n");
  const img = active.find((e) => e.rateUp)?.image;
  const body: Component[] = [section(`## Headhunting · ${server(srv).name}`, fileUrl(img)), separator(), text(s), text(PITY)];
  return frame(BRAND_COLOR, body, stateId("bn", srv), ctx, "Headhunting", [separator(), serverRow("bn", srv)]);
}

function eventsView(srv: Server["id"], ctx: Ctx): Rendered {
  const { active, upcoming } = timeline("event", srv, ctx.now);
  const fmt = (e: (typeof active)[number], future: boolean) => {
    const sp = span(e, srv)!;
    return `**${e.name}**${e.type ? ` · ${e.type}` : ""} — ${future ? `starts ${ts(sp.start, "R")}` : `ends ${ts(sp.end, "R")}`}`;
  };
  let s = "### Active\n" + (active.slice(0, 10).map((e) => fmt(e, false)).join("\n") || "none");
  if (upcoming.length) s += "\n### Upcoming\n" + upcoming.slice(0, 6).map((e) => fmt(e, true)).join("\n");
  const ver = timeline("version", srv, ctx.now).active[0];
  if (ver) s += `\n-# Version ${ver.name} until ${ts(span(ver, srv)!.end, "d")}`;
  const body: Component[] = [text(`## Events · ${server(srv).name}`), separator(), text(clip(s, 3000))];
  return frame(BRAND_COLOR, body, stateId("ev", srv), ctx, "Events", [separator(), serverRow("ev", srv)]);
}

function resetView(ctx: Ctx): Rendered {
  const lines = data.servers.map((srv) => {
    const d = nextDailyReset(srv, ctx.now);
    const w = nextWeeklyReset(srv, ctx.now);
    return `**${srv.name}** (UTC${srv.utcOffsetMin >= 0 ? "+" : "-"}${Math.abs(srv.utcOffsetMin / 60)})\nDaily ${ts(d, "R")} · ${ts(d, "t")}\nWeekly ${ts(w, "R")} · ${ts(w, "f")}`;
  });
  const body: Component[] = [text("## Server resets"), separator(), text(lines.join("\n\n")), text("-# Daily reset 04:00 server time, weekly on Monday. Times are shown in your timezone.")];
  return frame(BRAND_COLOR, body, stateId("rs"), ctx);
}

export function helpView(ctx: Ctx): Rendered {
  const s = [
    "`/operator` — kit, skills, talents, materials",
    "`/weapon` · `/gear` · `/item` · `/enemy` — wiki cards",
    "`/recipe` — how an item is made",
    "`/factory` — AIC production chain for a target rate",
    "`/banner` · `/events` · `/reset` — timers in your timezone",
    "`/wiki` — search any wiki page (lore, quests, regions)",
    "`/notify` — post banners/events/resets to a channel (server admins)",
  ].join("\n");
  return frame(BRAND_COLOR, [text("## Endfield bot"), separator(), text(s)], stateId("hp"), ctx);
}

/** Dispatch a state string to its view. */
export function render(state: string, ctx: Ctx): Rendered {
  const [view, a = "", b = ""] = state.split(SEP);
  switch (view) {
    case "op": return operatorView(a, b || "o", ctx);
    case "wp": return weaponView(a, ctx);
    case "gr": return setView(a, ctx);
    case "it": return itemView(a, ctx);
    case "en": return enemyView(a, ctx);
    case "rc": return recipeView(a, ctx);
    case "fa": return factoryView(a, Number(b), ctx);
    case "bn": return bannerView((a || "AMEU") as Server["id"], ctx);
    case "ev": return eventsView((a || "AMEU") as Server["id"], ctx);
    case "rs": return resetView(ctx);
    default: return helpView(ctx);
  }
}
