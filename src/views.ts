// Every screen the bot can show. A view is addressed by a compact state string
// ("op|Arclight|s") that is also used as the button custom_id, so buttons are stateless.
import { ButtonStyle } from "discord-api-types/v10";
import { data, factory, span, timeline, itemByName, localName } from "./data/index.ts";
import { t, type Lang, type Key } from "./i18n.ts";
import { SUPPORT_URL } from "./lib/links.ts";
import { findExact } from "./lib/search.ts";
import { renderTree, fmtRate } from "./lib/factory.ts";
import { nextDailyReset, nextWeeklyReset } from "./lib/time.ts";
import {
  BRAND_COLOR, RARITY_COLOR, button, clip, container, fileUrl, fmtMats, footer, gallery, linkButton, row, section,
  separator, stars, text, ts, wikiUrl, type Component,
} from "./lib/ui.ts";
import type { Server } from "./data/types.ts";

export interface Ctx {
  lang: Lang;
  now: number; // unix seconds
  shared: boolean; // already public: no "show everyone" button
}

export interface Rendered { components: Component[] }

const SEP = "|";
export const stateId = (...parts: (string | number)[]) => parts.join(SEP);

const titleOf = (e: { name: string; names?: Partial<Record<Lang, string>> }, ctx: Ctx) => {
  const local = ctx.lang === "en" ? undefined : e.names?.[ctx.lang];
  return local && local !== e.name ? `${e.name} · ${local}` : e.name;
};
const tr = (ctx: Ctx) => (key: Key, vars?: Record<string, string | number>) => t(ctx.lang, key, vars);
const nameIn = (ctx: Ctx) => (n: string) => localName(n, ctx.lang);
const serverName = (id: string, ctx: Ctx) => t(ctx.lang, id === "ASIA" ? "server_asia" : "server_ameu");

function frame(accent: number, body: Component[], state: string, ctx: Ctx, wikiPage?: string, extraRows: Component[] = []) {
  const actions: Component[] = [];
  if (wikiPage) actions.push(linkButton(t(ctx.lang, "wiki"), wikiUrl(wikiPage)));
  if (!ctx.shared) actions.push(button(t(ctx.lang, "show_everyone"), `pub${SEP}${state}`, { style: ButtonStyle.Success }));
  const inner = [...body, ...extraRows, separator(), footer(data.syncedAt, ctx.lang)];
  if (actions.length) inner.push(row(...actions));
  return { components: [container(accent, inner)] };
}

const notFound = (_what: string, q: string, ctx: Ctx): Rendered => ({
  components: [container(0xed4245, [text(t(ctx.lang, "not_found", { q }))])],
});

// ---------------- operator ----------------
const OP_TABS: [string, Key][] = [["o", "tab_overview"], ["s", "tab_skills"], ["t", "tab_talents"], ["m", "tab_materials"]];

function operatorView(name: string, tab: string, ctx: Ctx): Rendered {
  const op = findExact(data.operators, name);
  if (!op) return notFound("operators", name, ctx);
  const state = stateId("op", op.name, tab);
  const T = tr(ctx);
  const head = `## ${titleOf(op, ctx)}\n${stars(op.rarity)} · ${op.element} ${op.class} · ${op.weapon}\n-# ${op.faction}`;
  const body: Component[] = op.banner
    ? [gallery(fileUrl(op.banner)!), text(head), separator()]
    : [section(head, fileUrl(op.icon)), separator()];

  if (tab === "s") {
    let s = "";
    for (const sk of op.skills) {
      s += `### ${sk.type}: ${sk.name}\n${clip(sk.desc, 600)}\n`;
      const key = sk.stats.filter((x) => x.lv1 !== x.max).slice(0, 3);
      if (key.length) s += key.map((x) => `-# ${x.name}: ${x.lv1} → ${x.max}`).join("\n") + "\n";
    }
    body.push(text(clip(s || T("no_skills"), 3000)));
  } else if (tab === "t") {
    let s = "";
    for (const t of op.talents) {
      s += `### ${t.name}\n` + t.levels.map((l) => `**${l.cond || "—"}:** ${l.desc}`).join("\n") + "\n";
    }
    if (op.potentials.length) {
      s += `### ${T("potentials")}\n` + op.potentials.map((p) => `**P${p.n} ${p.title}:** ${p.desc}`).join("\n");
    }
    body.push(text(clip(s || T("no_talents"), 3000)));
  } else if (tab === "m") {
    const N = nameIn(ctx);
    let s = `### ${T("promotion")}\n` + op.promotions.map((p) => `**E${p.stage}:** ${fmtMats(p.mats, N)}`).join("\n");
    if (op.skillLevelMats.length) s += `\n### ${T("skill_shared")}\n${fmtMats(op.skillLevelMats, N)}`;
    if (op.masteryMats.length) s += `\n### ${T("skill_mastery")}\n${fmtMats(op.masteryMats, N)}`;
    body.push(text(clip(s, 3000)));
  } else {
    let s = op.summary ? `${clip(op.summary, 700)}\n\n` : "";
    s += `**${T("main")}:** ${op.main} · **${T("sub")}:** ${op.sub}\n`;
    if (op.tags.length) s += `**${T("tags")}:** ${op.tags.join(", ")}\n`;
    const st = op.maxStats;
    if (st.HP) s += `**${T("max_stats")}:** HP ${st.HP} · ATK ${st.ATK} · STR ${st.STR} · AGL ${st.AGL} · INT ${st.INT} · WIL ${st.WIL}\n`;
    if (op.synergy.length) s += `**${T("recommended")}:** ${op.synergy.map(nameIn(ctx)).join(", ")}\n`;
    if (op.quote) s += `\n> *${clip(op.quote, 300)}*`;
    body.push(text(s));
  }
  const tabs = row(...OP_TABS.map(([k, label]) => button(T(label), stateId("op", op.name, k), { active: k === tab })));
  return frame(RARITY_COLOR[op.rarity] ?? BRAND_COLOR, body, state, ctx, op.name, [separator(), tabs]);
}

// ---------------- weapon ----------------
function weaponView(name: string, ctx: Ctx): Rendered {
  const w = findExact(data.weapons, name);
  if (!w) return notFound("weapons", name, ctx);
  const T = tr(ctx);
  let s = `## ${titleOf(w, ctx)}\n${stars(w.rarity)} · ${w.type}`;
  const body: Component[] = [section(s, fileUrl(w.icon)), separator()];
  s = "";
  if (w.baseAtk) s += `**${T("base_atk")}:** ${w.baseAtk}\n`;
  if (w.skills.length) s += `**${T("skills")}:** ${w.skills.join(" · ")}\n`;
  if (w.potential) s += `**${T("potential")}:** ${w.potential}\n`;
  if (w.source) s += `**${T("source")}:** ${w.source}\n`;
  if (w.ascension.length) s += `### ${T("ascension")}\n` + w.ascension.map((a) => `**${a.stage}:** ${fmtMats(a.mats, nameIn(ctx))}`).join("\n");
  const users = data.operators.filter((o) => o.synergy.includes(w.name)).map((o) => nameIn(ctx)(o.name));
  if (users.length) s += `\n**${T("recommended_for")}:** ${users.join(", ")}`;
  body.push(text(clip(s, 3000)));
  return frame(RARITY_COLOR[w.rarity] ?? BRAND_COLOR, body, stateId("wp", w.name), ctx, w.name);
}

// ---------------- gear / set ----------------
function setView(name: string, ctx: Ctx): Rendered {
  const set = findExact(data.sets, name);
  const piece = set ? undefined : findExact(data.gear, name);
  const target = set ?? (piece?.set ? data.sets.find((x) => x.name === piece.set) : undefined);
  if (!target && !piece) return notFound("gear", name, ctx);
  const T = tr(ctx);
  const body: Component[] = [];
  if (piece) {
    let s = `## ${titleOf(piece, ctx)}\n${stars(piece.rarity)} · ${piece.type} · Lv ${piece.level}`;
    body.push(section(s, fileUrl(piece.icon)), separator());
    s = piece.defense ? `**${T("def")}:** ${piece.defense}\n` : "";
    s += piece.stats.map((x) => `**${x.stat}:** ${x.values.join(" / ")}`).join("\n");
    if (piece.source) s += `\n**${T("source")}:** ${piece.source}`;
    body.push(text(s || T("no_stats")));
  }
  if (target) {
    if (piece) body.push(separator());
    body.push(
      section(`### ${T("set")}: ${titleOf(target, ctx)} (Lv ${target.level})\n${clip(target.effect, 1200)}`, piece ? undefined : fileUrl(target.icon)),
    );
    if (target.pieces.length) body.push(text(`-# ${T("pieces")}: ${target.pieces.map(nameIn(ctx)).join(", ")}`));
  }
  return frame(RARITY_COLOR[piece?.rarity ?? 5] ?? BRAND_COLOR, body, stateId("gr", piece?.name ?? target!.name), ctx, piece?.name ?? target!.name);
}

// ---------------- item ----------------
function itemView(name: string, ctx: Ctx): Rendered {
  const it = findExact(data.items, name);
  if (!it) return notFound("items", name, ctx);
  const T = tr(ctx);
  const N = nameIn(ctx);
  const body: Component[] = [section(`## ${titleOf(it, ctx)}\n${stars(it.rarity)} · ${it.type}`, fileUrl(it.icon)), separator()];
  let s = "";
  if (it.desc) s += `${clip(it.desc, 600)}\n`;
  if (it.use) s += `**${T("use_obtain")}:** ${clip(it.use, 600)}\n`;
  const made = data.recipes.filter((r) => r.products.some((p) => p.item === it.name));
  const used = data.recipes.filter((r) => r.ingredients.some((p) => p.item === it.name));
  if (made.length) s += `**${T("made_in")}:** ${[...new Set(made.map((r) => N(r.facility)))].join(", ")}\n`;
  if (used.length) {
    const outs = [...new Set(used.flatMap((r) => r.products.map((p) => p.item)))];
    s += `**${T("used_for")}:** ${clip(outs.map(N).join(", "), 700)}\n`;
  }
  body.push(text(s || T("no_description")));
  const extra: Component[] = [];
  if (made.length) {
    const btns = [button(T("recipes_btn"), stateId("rc", it.name))];
    if (factory.producible(it.name)) btns.push(button(T("chain_btn"), stateId("fa", it.name, 30)));
    extra.push(row(...btns));
  }
  return frame(RARITY_COLOR[it.rarity] ?? BRAND_COLOR, body, stateId("it", it.name), ctx, it.name, extra);
}

// ---------------- enemy ----------------
function enemyView(name: string, ctx: Ctx): Rendered {
  const e = findExact(data.enemies, name);
  if (!e) return notFound("enemies", name, ctx);
  const head = `## ${titleOf(e, ctx)}\n${e.type} · ${e.class}`;
  const body: Component[] = [section(head, fileUrl(e.image)), separator(), text(clip(e.summary || t(ctx.lang, "no_description"), 1500))];
  return frame(e.class === "Boss" ? 0xed4245 : e.class === "Elite" ? 0xff7a1a : 0x95a5a6, body, stateId("en", e.name), ctx, e.name);
}

// ---------------- recipes ----------------
function recipeView(name: string, ctx: Ctx): Rendered {
  const it = findExact(data.items, name) ?? { name, names: undefined, rarity: 0 };
  const T = tr(ctx);
  const N = nameIn(ctx);
  const made = data.recipes.filter((r) => r.products.some((p) => p.item === it.name));
  if (!made.length) return notFound("recipes", name, ctx);
  let s = "";
  for (const r of made.slice(0, 8)) {
    const time = r.time ? ` · ${r.time}s` : "";
    s += `**${N(r.facility)}**${time}${r.mode ? ` · ${r.mode}` : ""}\n${fmtMats(r.ingredients, N)} → ${fmtMats(r.products, N)}\n`;
  }
  if (made.length > 8) s += `-# ${T("more_on_wiki", { n: made.length - 8 })}`;
  const body: Component[] = [section(`## ${T("recipes")}: ${titleOf(it, ctx)}`, fileUrl(itemByName.get(it.name)?.icon)), separator(), text(s)];
  const extra = factory.producible(it.name) ? [row(button(T("chain_btn_rate", { rate: 30 }), stateId("fa", it.name, 30)))] : [];
  return frame(BRAND_COLOR, body, stateId("rc", it.name), ctx, it.name, extra);
}

// ---------------- factory ----------------
export function factoryView(name: string, rate: number, ctx: Ctx): Rendered {
  const target = findExact(
    factory.items().map((n) => ({ name: n, names: itemByName.get(n)?.names })),
    name,
  );
  if (!target) return notFound("AIC recipes", name, ctx);
  rate = Math.min(Math.max(rate || 30, 0.1), 10000);
  const res = factory.solve(target.name, rate);
  const T = tr(ctx);
  const N = nameIn(ctx);
  const pm = T("per_min");
  const machines = [...res.machines].map(([f, n]) => `${N(f)} ×${n}`).join(", ");
  const raws = [...res.raw].map(([i, r]) => `${N(i)} ${fmtRate(r)}${pm}`).join(", ");
  const byp = collectByproducts(res.root, N, pm);
  let s = `**${T("machines")}:** ${machines}\n**${T("raw_input")}:** ${raws}\n`;
  s += `**${T("power")}:** ${res.power}${res.unknownPower.length ? T("power_unknown", { list: res.unknownPower.map(N).join(", ") }) : ""}\n`;
  if (byp.length) s += `**${T("byproducts")}:** ${byp.join(", ")}\n`;
  const tree = clip(renderTree(res.root, N, pm), 2200);
  const body: Component[] = [
    section(`## ${titleOf(target, ctx)} — ${fmtRate(rate)}${pm}`, fileUrl(itemByName.get(target.name)?.icon)),
    separator(),
    text(s),
    text("```\n" + tree + "```"),
    text(`${T("tree_note")}\n${T("tree_legend")}`),
  ];
  const controls = row(
    button("÷2", stateId("fa", target.name, rate / 2)),
    button("×2", stateId("fa", target.name, rate * 2)),
    button(T("set_rate"), stateId("fam", target.name)),
  );
  return frame(BRAND_COLOR, body, stateId("fa", target.name, rate), ctx, target.name, [controls]);
}

function collectByproducts(
  node: import("./lib/factory.ts").ChainNode,
  nameOf: (n: string) => string,
  perMin: string,
  acc = new Map<string, number>(),
): string[] {
  for (const b of node.byproducts) acc.set(b.item, (acc.get(b.item) ?? 0) + b.rate);
  node.inputs.forEach((c) => collectByproducts(c, nameOf, perMin, acc));
  return [...acc].map(([i, r]) => `${nameOf(i)} ${fmtRate(r)}${perMin}`);
}

// ---------------- timeline ----------------
const serverRow = (view: string, srv: string, ctx: Ctx) =>
  row(...(["AMEU", "ASIA"] as const).map((id) => button(serverName(id, ctx), stateId(view, id), { active: id === srv })));

function bannerView(srv: Server["id"], ctx: Ctx): Rendered {
  const T = tr(ctx);
  const { active, upcoming } = timeline("banner", srv, ctx.now);
  const line = (e: (typeof active)[number], future: boolean) => {
    const sp = span(e, srv)!;
    const who = e.rateUp ? ` — ${T("rate_up")} **${localName(e.rateUp, ctx.lang)}**` : "";
    return future
      ? `**${e.name}**${who}\n${T("starts")} ${ts(sp.start, "R")} (${ts(sp.start)})`
      : `**${e.name}**${who}\n${T("ends")} ${ts(sp.end, "R")} (${ts(sp.end)})`;
  };
  let s = `### ${T("active")}\n` + (active.map((e) => line(e, false)).join("\n") || T("none"));
  if (upcoming.length) s += `\n### ${T("upcoming")}\n` + upcoming.slice(0, 4).map((e) => line(e, true)).join("\n");
  const img = active.find((e) => e.rateUp)?.image;
  const body: Component[] = [section(`## ${T("headhunting")} · ${serverName(srv, ctx)}`, fileUrl(img)), separator(), text(s), text(T("pity"))];
  return frame(BRAND_COLOR, body, stateId("bn", srv), ctx, "Headhunting", [separator(), serverRow("bn", srv, ctx)]);
}

function eventsView(srv: Server["id"], ctx: Ctx): Rendered {
  const T = tr(ctx);
  const { active, upcoming } = timeline("event", srv, ctx.now);
  const fmt = (e: (typeof active)[number], future: boolean) => {
    const sp = span(e, srv)!;
    return `**${e.name}**${e.type ? ` · ${e.type}` : ""} — ${future ? `${T("starts")} ${ts(sp.start, "R")}` : `${T("ends")} ${ts(sp.end, "R")}`}`;
  };
  let s = `### ${T("active")}\n` + (active.slice(0, 10).map((e) => fmt(e, false)).join("\n") || T("none"));
  if (upcoming.length) s += `\n### ${T("upcoming")}\n` + upcoming.slice(0, 6).map((e) => fmt(e, true)).join("\n");
  const ver = timeline("version", srv, ctx.now).active[0];
  if (ver) s += "\n" + T("version_until", { name: ver.name, date: ts(span(ver, srv)!.end, "d") });
  const body: Component[] = [text(`## ${T("events")} · ${serverName(srv, ctx)}`), separator(), text(clip(s, 3000))];
  return frame(BRAND_COLOR, body, stateId("ev", srv), ctx, "Events", [separator(), serverRow("ev", srv, ctx)]);
}

function resetView(ctx: Ctx): Rendered {
  const T = tr(ctx);
  const lines = data.servers.map((srv) => {
    const d = nextDailyReset(srv, ctx.now);
    const w = nextWeeklyReset(srv, ctx.now);
    return `**${serverName(srv.id, ctx)}** (UTC${srv.utcOffsetMin >= 0 ? "+" : "-"}${Math.abs(srv.utcOffsetMin / 60)})\n${T("daily")} ${ts(d, "R")} · ${ts(d, "t")}\n${T("weekly")} ${ts(w, "R")} · ${ts(w, "f")}`;
  });
  const body: Component[] = [text(`## ${T("resets")}`), separator(), text(lines.join("\n\n")), text(T("reset_note"))];
  return frame(BRAND_COLOR, body, stateId("rs"), ctx);
}

export function helpView(ctx: Ctx): Rendered {
  const s = (["help_1", "help_2", "help_3", "help_4", "help_5", "help_6", "help_7"] as const).map((k) => t(ctx.lang, k)).join("\n");
  return frame(BRAND_COLOR, [text(`## ${t(ctx.lang, "help_title")}`), separator(), text(s)], stateId("hp"), ctx, undefined, [
    row(linkButton(t(ctx.lang, "support_btn"), SUPPORT_URL)),
  ]);
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
