// Builds data/dataset.json from endfield.wiki.gg (Cargo tables + page wikitext + recipe modules).
// Run: npm run sync
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { cargo, raw, wikitexts, descriptions, modules } from "./wiki.ts";
import { templates, clean, materials, lead, type Params } from "./wikitext.ts";
import { parseLuaData } from "./lua.ts";
import type {
  Dataset, Operator, Weapon, Gear, GearSet, Item, Enemy, Recipe, Facility, TimedEntry, Server, Mat,
} from "../src/data/types.ts";

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const num = (s: string | undefined) => (s && s !== "" ? Number(s) : 0);
const log = (...a: unknown[]) => console.log("[sync]", ...a);

const SKILL_TYPES: Record<string, string> = { "1": "Basic Attack", "2": "Battle Skill", "3": "Combo Skill", "4": "Ultimate" };

function addMats(acc: Map<string, number>, mats: Mat[]) {
  for (const m of mats) acc.set(m.item, (acc.get(m.item) ?? 0) + m.count);
}
const toMats = (acc: Map<string, number>): Mat[] => [...acc].map(([item, count]) => ({ item, count }));

/** "m1=Protoprism,6" style params -> mats. prefix "m" or "m1" (skill 1 of mastery). */
function cellMats(p: Params, prefix: string): Mat[] {
  const out: Mat[] = [];
  for (let k = 1; k <= 6; k++) {
    const v = p[`${prefix}${k}`];
    if (!v) continue;
    const [item, count] = v.split(",");
    out.push({ item: item.trim(), count: Number(count) });
  }
  return out;
}

/** Server-local "YYYY-MM-DD HH:MM:SS" -> unix seconds. offsetMin = minutes ahead of UTC. */
function localToUnix(s: string | undefined, offsetMin: number): number | undefined {
  if (!s) return undefined;
  const t = Date.parse(s.replace(" ", "T") + "Z");
  return Number.isNaN(t) ? undefined : Math.round(t / 1000) - offsetMin * 60;
}

async function main() {
  // Names in Russian (Locales has ~2k ru names: operators, items, weapons...).
  const ruRows = await cargo("Locales", ["Entity", "Value"], "Lang='ru' AND Param='name'");
  const ru = new Map(ruRows.map((r) => [decode(r.Entity), decode(r.Value)]));
  log("ru names", ru.size);

  // ---------- Operators ----------
  const opRows = await cargo("Operators", [
    "Operator", "Icon", "Banner", "Splash", "Rarity", "Class", "Weapon", "Element", "Faction", "Tags", "MainAttr", "SubAttr",
  ]);
  const opTexts = await wikitexts(opRows.map((r) => decode(r.Operator)));
  const operators: Operator[] = [];
  for (const r of opRows) {
    const name = decode(r.Operator);
    const text = opTexts.get(name) ?? "";
    const info = templates(text, "Operator infobox")[0] ?? {};
    const data = templates(text, "Operator data")[0] ?? {};
    const maxStats: Record<string, string> = {};
    for (const k of ["HP", "ATK", "STR", "AGL", "INT", "WIL"]) {
      const vals = (data[k] ?? "").split(",").map((v) => v.trim()).filter(Boolean);
      if (vals.length) maxStats[k] = String(Math.round(Number(vals[vals.length - 1])));
    }
    const promotions = [1, 2, 3, 4]
      .map((n) => ({ stage: n, mats: materials(data[`e${n}`]) }))
      .filter((p) => p.mats.length);
    const potentials = [1, 2, 3, 4, 5]
      .filter((n) => data[`pot${n}`])
      .map((n) => ({ n, title: clean(data[`pot${n}t`]), desc: clean(data[`pot${n}`]) }));
    const skills = templates(text, "Combat skill").map((s) => {
      const type = SKILL_TYPES[(s.type ?? "").match(/\d/)?.[0] ?? ""] ?? clean(s.type);
      const stats = Object.keys(s)
        .filter((k) => /^stat\d+$/.test(k))
        .map((k) => s[k].split(",").map((v) => v.trim()))
        .map((v) => ({ name: v[0], lv1: v[1] ?? "", max: v[v.length - 1] ?? "" }));
      return { name: clean(s.name), type, desc: clean(s.desc), stats };
    });
    const talents = templates(text, "Operator talent").map((t) => ({
      name: clean(t.name),
      levels: [1, 2, 3, 4]
        .filter((n) => t[`desc${n}`])
        .map((n) => ({ cond: clean(t[`cond${n}`]), desc: clean(t[`desc${n}`]) })),
    }));
    const skillLv = new Map<string, number>();
    const mastery = new Map<string, number>();
    for (const c of templates(text, "Skill upgrade cell")) {
      const level = Number(c.level);
      if (level <= 9) addMats(skillLv, cellMats(c, "m"));
      else addMats(mastery, cellMats(c, "m1"));
    }
    const synergy = [info.matskill, info.matstats]
      .filter(Boolean)
      .flatMap((s) => s.split(",").map((x) => x.trim()))
      .filter(Boolean);

    operators.push({
      name,
      ru: ru.get(name) ?? (info.runame || undefined),
      rarity: num(r.Rarity),
      class: r.Class,
      weapon: r.Weapon,
      element: r.Element,
      faction: decode(r.Faction ?? ""),
      tags: (r.Tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      main: r.MainAttr,
      sub: r.SubAttr,
      quote: clean(info.quote),
      summary: lead(text),
      icon: r.Icon || undefined,
      splash: r.Splash || undefined,
      banner: r.Banner || undefined,
      maxStats,
      promotions,
      potentials,
      skills,
      talents,
      skillLevelMats: toMats(skillLv),
      masteryMats: toMats(mastery),
      synergy,
    });
  }
  log("operators", operators.length);

  // ---------- Weapons ----------
  const wRows = await cargo("Weapons", ["Weapon", "Icon", "Type", "Rarity", "Source"]);
  const wTexts = await wikitexts(wRows.map((r) => decode(r.Weapon)));
  const weapons: Weapon[] = wRows.map((r) => {
    const name = decode(r.Weapon);
    const text = wTexts.get(name) ?? "";
    const data = templates(text, "Weapon data")[0] ?? {};
    const skill = templates(text, "Weapon skill")[0] ?? {};
    const atk = (data.BATK ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    const ascension = [1, 2, 3, 4]
      .map((n) => ({
        stage: n,
        mats: [...(data[`t${n}`] ?? "").matchAll(/\{\{\s*I\s*\|([^|}]+)\|(\d+)/g)].map((m) => ({
          item: m[1].trim(),
          count: Number(m[2]),
        })),
      }))
      .filter((a) => a.mats.length);
    return {
      name,
      ru: ru.get(name),
      rarity: num(r.Rarity),
      type: r.Type,
      source: clean(r.Source),
      summary: lead(text),
      icon: r.Icon || undefined,
      baseAtk: atk.length ? `${atk[0]} → ${atk[atk.length - 1]}` : "",
      skills: ["2", "3", "4"].map((k) => clean(skill[k])).filter(Boolean),
      potential: clean(data.pot),
      ascension,
    };
  });
  log("weapons", weapons.length);

  // ---------- Gear & sets ----------
  const gRows = await cargo("Gears", ["Gear", "Icon", "Type", "Rarity", "Level", "Source"]);
  const gsRows = await cargo("GearStats", [
    "Gear", "Defense", "PStat", "PValue0", "PValue1", "PValue2", "PValue3", "SStat", "SValue0", "SValue1", "SValue2",
    "SValue3", "TStat", "TValue0", "TValue1", "TValue2", "TValue3", "SetName",
  ]);
  const gStats = new Map(gsRows.map((r) => [decode(r.Gear), r]));
  const gear: Gear[] = gRows
    .filter((r) => !/ T\d$/.test(decode(r.Gear))) // T1..T3 refinement variants clutter search
    .map((r) => {
      const name = decode(r.Gear);
      const s = gStats.get(name);
      const stats = (["P", "S", "T"] as const)
        .filter((p) => s?.[`${p}Stat`])
        .map((p) => ({
          stat: s![`${p}Stat`],
          values: [0, 1, 2, 3].map((i) => Number(s![`${p}Value${i}`])).filter((v) => !Number.isNaN(v) && v !== 0),
        }));
      return {
        name,
        ru: ru.get(name),
        rarity: num(r.Rarity),
        type: r.Type,
        level: num(r.Level),
        set: decode(s?.SetName ?? ""),
        source: clean(r.Source),
        defense: s?.Defense ? Number(s.Defense) : undefined,
        stats,
        icon: r.Icon || undefined,
      };
    });
  const setRows = await cargo("GearSets", ["GearSet", "Icon", "Level", "Effect"]);
  const sets: GearSet[] = setRows.map((r) => {
    const name = decode(r.GearSet);
    return {
      name,
      ru: ru.get(name),
      level: num(r.Level),
      effect: clean(r.Effect),
      pieces: gear.filter((g) => g.set === name).map((g) => g.name),
      icon: r.Icon || undefined,
    };
  });
  log("gear", gear.length, "sets", sets.length);

  // ---------- Items ----------
  const iRows = await cargo("Items", ["Item", "Image", "Rarity", "Type"]);
  const dRows = await cargo("ItemDescriptions", ["item", "itemUse", "description"], "lang='en'");
  const iDesc = new Map(dRows.map((r) => [decode(r.item), r]));
  const items: Item[] = iRows.map((r) => {
    const name = decode(r.Item);
    const d = iDesc.get(name);
    return {
      name,
      ru: ru.get(name),
      rarity: num(r.Rarity),
      type: r.Type,
      use: clean(d?.itemUse),
      desc: clean(d?.description),
      icon: r.Image || undefined,
    };
  });
  log("items", items.length);

  // ---------- Enemies ----------
  const eRows = await cargo("Enemies", ["Enemy", "Image", "Type", "Class"]);
  const eDesc = await descriptions(eRows.map((r) => decode(r.Enemy)));
  const enemies: Enemy[] = eRows.map((r) => {
    const name = decode(r.Enemy);
    return {
      name,
      ru: ru.get(name),
      type: r.Type,
      class: r.Class,
      summary: clean(eDesc.get(name)),
      image: r.Image || undefined,
    };
  });
  log("enemies", enemies.length);

  // ---------- Recipes & facilities ----------
  const recipes: Recipe[] = [];
  for (const title of await modules("Recipe/")) {
    if (title.includes("/betatest") || title.endsWith("/doc")) continue;
    let parsed: any;
    try {
      parsed = parseLuaData(await raw(title));
    } catch (e) {
      log("skip", title, (e as Error).message);
      continue;
    }
    const manual = title.endsWith("/Crafting") || title.endsWith("/Construct");
    for (const r of parsed as any[]) {
      if (r.event) continue; // limited-time event recipes
      recipes.push({
        facility: manual ? title.split("/")[1] : r.facility,
        time: manual ? undefined : r.time,
        mode: r.mode || undefined,
        ingredients: (r.ingredients ?? []).map((m: any) => ({ item: m.item, count: m.count })),
        products: (r.products ?? []).map((m: any) => ({ item: m.item, count: m.count })),
      });
    }
  }
  const fRows = await cargo("Facilities", ["Facility", "Icon", "Power"]);
  const overrides = existsSync("data/overrides.json") ? JSON.parse(readFileSync("data/overrides.json", "utf8")) : {};
  const facilities: Facility[] = fRows.map((r) => {
    const name = decode(r.Facility);
    return { name, power: overrides.power?.[name] ?? (r.Power ? Number(r.Power) : undefined), icon: r.Icon || undefined };
  });
  log("recipes", recipes.length, "facilities", facilities.length);

  // ---------- Timeline ----------
  const servers: Server[] = [];
  for (const r of await cargo("Servers", ["Server", "Name", "TzOffset"])) {
    if (servers.some((s) => s.id === r.Server)) continue;
    servers.push({ id: r.Server as Server["id"], name: r.Name, utcOffsetMin: -Number(r.TzOffset) });
  }
  const off = (id: string) => servers.find((s) => s.id === id)?.utcOffsetMin ?? 0;
  const span = (r: Record<string, string>, srv: "Asia" | "Ameu") => {
    const start = localToUnix(r[`${srv}StartTime`], off(srv.toUpperCase()));
    const end = localToUnix(r[`${srv}EndTime`], off(srv.toUpperCase()));
    return start && end ? { start, end } : undefined;
  };
  const timeline: TimedEntry[] = [];
  for (const r of await cargo("Banners", [
    "Banner", "Image", "RateUpOperator", "AsiaStartTime", "AsiaEndTime", "AmeuStartTime", "AmeuEndTime",
  ])) {
    timeline.push({
      name: decode(r.Banner), kind: "banner", rateUp: r.RateUpOperator || undefined, image: r.Image || undefined,
      asia: span(r, "Asia"), ameu: span(r, "Ameu"),
    });
  }
  for (const r of await cargo("Events", [
    "Event", "Type", "Image", "AsiaStartTime", "AsiaEndTime", "AmeuStartTime", "AmeuEndTime",
  ])) {
    timeline.push({
      name: decode(r.Event), kind: "event", type: r.Type || undefined, image: r.Image || undefined,
      asia: span(r, "Asia"), ameu: span(r, "Ameu"),
    });
  }
  for (const r of await cargo("Versions", ["Version", "VersionNumber", "StartTime", "EndTime"])) {
    const start = r.StartTime ? Math.round(Date.parse(r.StartTime.replace(" ", "T") + "Z") / 1000) : undefined;
    const end = r.EndTime ? Math.round(Date.parse(r.EndTime.replace(" ", "T") + "Z") / 1000) : undefined;
    if (start && end) {
      timeline.push({ name: `${r.VersionNumber} ${decode(r.Version)}`.trim(), kind: "version", asia: { start, end }, ameu: { start, end } });
    }
  }
  log("timeline", timeline.length);

  const dataset: Dataset = {
    syncedAt: new Date().toISOString(),
    operators, weapons, gear, sets, items, enemies, recipes, facilities, timeline, servers,
  };
  mkdirSync("data", { recursive: true });
  // keep the old timestamp when nothing changed, so the nightly job only redeploys on real changes
  if (existsSync("data/dataset.json")) {
    const prev = JSON.parse(readFileSync("data/dataset.json", "utf8")) as Dataset;
    if (JSON.stringify({ ...prev, syncedAt: "" }) === JSON.stringify({ ...dataset, syncedAt: "" })) {
      log("no changes");
      return;
    }
  }
  const json = JSON.stringify(dataset);
  writeFileSync("data/dataset.json", json);
  log(`wrote data/dataset.json (${(json.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
