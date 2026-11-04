// Forgiving name search for autocomplete and lookups (English + Russian names).

export interface Searchable { name: string; ru?: string }

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function score(query: string, candidate: string): number {
  const c = norm(candidate);
  if (!c) return Infinity;
  if (c === query) return 0;
  if (c.startsWith(query)) return 1 + c.length / 1000;
  if (c.split(" ").some((w) => w.startsWith(query))) return 2 + c.length / 1000;
  const idx = c.indexOf(query);
  if (idx >= 0) return 3 + idx / 100;
  // subsequence match (typos like "arclght")
  let qi = 0;
  let gaps = 0;
  for (let i = 0; i < c.length && qi < query.length; i++) {
    if (c[i] === query[qi]) qi++;
    else if (qi > 0) gaps++;
  }
  if (qi === query.length) return 5 + gaps / 10;
  return Infinity;
}

export function search<T extends Searchable>(list: T[], query: string, limit = 25): T[] {
  const q = norm(query);
  if (!q) return list.slice(0, limit);
  return list
    .map((item) => ({ item, s: Math.min(score(q, item.name), item.ru ? score(q, item.ru) : Infinity) }))
    .filter((x) => x.s < Infinity)
    .sort((a, b) => a.s - b.s || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((x) => x.item);
}

export function findExact<T extends Searchable>(list: T[], name: string): T | undefined {
  const q = norm(name);
  return list.find((x) => norm(x.name) === q) ?? list.find((x) => x.ru && norm(x.ru) === q) ?? search(list, name, 1)[0];
}

export function choices(list: Searchable[], query: string, ru: boolean) {
  return search(list, query).map((x) => ({
    name: (ru && x.ru && x.ru !== x.name ? `${x.name} · ${x.ru}` : x.name).slice(0, 100),
    value: x.name.slice(0, 100),
  }));
}
