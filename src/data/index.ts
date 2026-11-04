// Loads the bundled dataset once per isolate and exposes lookups.
import raw from "../../data/dataset.json";
import overrides from "../../data/overrides.json";
import type { Dataset, Server, TimedEntry } from "./types.ts";
import { Factory } from "../lib/factory.ts";

export const data = raw as unknown as Dataset;

export const factory = new Factory(data.recipes, data.facilities, (overrides as any).preferredRecipe ?? {});

/** Items that some AIC machine can produce, as searchable entries. */
export const producible = factory
  .items()
  .map((name) => ({ name, ru: data.items.find((i) => i.name === name)?.ru }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const allRecipeItems = [
  ...new Set(data.recipes.flatMap((r) => r.products.map((p) => p.item))),
].map((name) => ({ name, ru: data.items.find((i) => i.name === name)?.ru }));

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
