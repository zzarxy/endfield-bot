// Forgiving name search for autocomplete and lookups (English plus every localized name).
// Entities carry precomputed normalized keys (see pipeline/sync.ts), so a search only normalizes the query:
// the free Workers plan allows 10 ms of CPU per request.
import type { Lang } from "../i18n.ts";
import { norm } from "./norm.ts";

export interface Searchable { name: string; names?: Partial<Record<Lang, string>>; keys?: string[] }

function score(query: string, c: string): number {
  if (!c) return Infinity;
  if (c === query) return 0;
  if (c.startsWith(query)) return 1 + c.length / 1000;
  const idx = c.indexOf(query);
  if (idx >= 0) return c[idx - 1] === " " ? 2 + c.length / 1000 : 3 + idx / 100;
  if (query.length < 3) return Infinity; // subsequence guessing is only useful for longer typos
  // subsequence match (typos like "arclght")
  let qi = 0;
  let gaps = 0;
  for (let i = 0; i < c.length && qi < query.length; i++) {
    if (c[i] === query[qi]) qi++;
    else if (qi > 0) gaps++;
  }
  return qi === query.length ? 5 + gaps / 10 : Infinity;
}

const keysOf = (item: Searchable): string[] =>
  item.keys ?? [item.name, ...Object.values(item.names ?? {})].map(norm);

function bestScore(q: string, item: Searchable): number {
  let best = Infinity;
  for (const k of keysOf(item)) {
    const s = score(q, k);
    if (s < best) best = s;
  }
  return best;
}

export function search<T extends Searchable>(list: T[], query: string, limit = 25): T[] {
  const q = norm(query);
  if (!q) return list.slice(0, limit);
  const hits: { item: T; s: number }[] = [];
  for (const item of list) {
    const s = bestScore(q, item);
    if (s < Infinity) hits.push({ item, s });
  }
  return hits
    .sort((a, b) => a.s - b.s || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((x) => x.item);
}

export function findExact<T extends Searchable>(list: T[], name: string): T | undefined {
  const q = norm(name);
  return list.find((x) => keysOf(x).includes(q)) ?? search(list, name, 1)[0];
}

/** Autocomplete choices: the value is always the English name, the label adds the user's language. */
export function choices(list: Searchable[], query: string, lang: Lang) {
  return search(list, query).map((x) => {
    const local = lang === "en" ? undefined : x.names?.[lang];
    return {
      name: (local && local !== x.name ? `${x.name} · ${local}` : x.name).slice(0, 100),
      value: x.name.slice(0, 100),
    };
  });
}
