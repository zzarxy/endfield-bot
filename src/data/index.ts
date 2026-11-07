// Loads the bundled dataset once per isolate and exposes lookups.
import raw from "../../data/dataset.json";
import overrides from "../../data/overrides.json";
import type { Dataset, Names, Server, TimedEntry } from "./types.ts";
import type { Lang } from "../i18n.ts";
import { Factory } from "../lib/factory.ts";

export const data = raw as unknown as Dataset;

export const factory = new Factory(data.recipes, data.facilities, (overrides as any).preferredRecipe ?? {});

/** Items that some AIC machine can produce, as searchable entries. */
export const producible = factory
  .items()
  .map((name) => ({ name, names: data.items.find((i) => i.name === name)?.names }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const allRecipeItems = [
  ...new Set(data.recipes.flatMap((r) => r.products.map((p) => p.item))),
].map((name) => ({ name, names: data.items.find((i) => i.name === name)?.names }));

export const server = (id: string): Server => data.servers.find((s) => s.id === id) ?? data.servers[0];

export function span(e: TimedEntry, srv: Server["id"]) {
  return srv === "ASIA" ? e.asia ?? e.ameu : e.ameu ?? e.asia;
}

export function timeline(kind: TimedEntry["kind"], srv: Server["id"], now: number) {
  const list = data.timeline.filter((e) => e.kind === kind && span(e, srv));
  const active = list.filter((e) => span(e, srv)!.start <= now && now < span(e, srv)!.end);
  const upcoming = list.filter((e) => span(e, srv)!.start > now);
  const by = (k: "start" | "end") => (a: TimedEntry, b: TimedEntry) => span(a, srv)![k] - span(b, srv)![k];
  return { active: active.sort(by("end")), upcoming: upcoming.sort(by("start")) };
}

export const itemByName = new Map(data.items.map((i) => [i.name, i]));

// One lookup for every entity kind, so lists of materials/machines can be shown in the user's language
const allNames = new Map<string, Names | undefined>();
for (const list of [data.facilities, data.items, data.operators, data.weapons, data.gear, data.sets, data.enemies]) {
  for (const e of list as { name: string; names?: Names }[]) if (!allNames.has(e.name) || e.names) allNames.set(e.name, e.names);
}

/** Name of any known entity in `lang`, falling back to the English name. */
export const localName = (name: string, lang: Lang) => (lang === "en" ? name : allNames.get(name)?.[lang] ?? name);
