// AIC production-chain calculator: machines needed for a target output rate, down to raw inputs.
import type { Recipe, Facility } from "../data/types.ts";

const MANUAL = new Set(["Crafting", "Construct"]);

export interface ChainNode {
  item: string;
  rate: number; // items per minute
  recipe?: Recipe;
  machines: number; // fractional
  byproducts: { item: string; rate: number }[];
  inputs: ChainNode[];
  loop?: boolean; // fed back from the same item further up the chain
}

export interface ChainResult {
  root: ChainNode;
  machines: Map<string, number>; // facility -> whole machines
  raw: Map<string, number>; // raw item -> per minute
  power: number;
  unknownPower: string[];
}

export class Factory {
  private byProduct = new Map<string, Recipe[]>();
  private power = new Map<string, number | undefined>();
  private choice = new Map<string, Recipe>();

  constructor(recipes: Recipe[], facilities: Facility[], preferred: Record<string, string> = {}) {
    for (const r of recipes) {
      if (MANUAL.has(r.facility) || !r.time) continue;
      for (const p of r.products) {
        // un-bottling ("X Bottle (Fluid)" -> Fluid) is a loop, not a way to source the fluid
        if (r.ingredients.some((ing) => ing.item.endsWith(`(${p.item})`))) continue;
        const list = this.byProduct.get(p.item) ?? [];
        list.push(r);
        this.byProduct.set(p.item, list);
      }
    }
    // preferred machine for items with several recipes (overrides.json), else the simplest recipe
    for (const [item, list] of this.byProduct) {
      const pref = preferred[item];
      list.sort((a, b) =>
        (pref ? Number(b.facility === pref) - Number(a.facility === pref) : 0) ||
        a.ingredients.length - b.ingredients.length,
      );
    }
    for (const f of facilities) this.power.set(f.name, f.power);

    // Pick one recipe per item. A loop that needs as much of the item as it makes (f >= 1)
    // can't run, so try the next recipe, or treat the item as raw if none works.
    for (const [item, list] of this.byProduct) this.choice.set(item, list[0]);
    for (let pass = 0; pass < 3; pass++) {
      for (const [item, list] of this.byProduct) {
        let picked: Recipe | undefined;
        for (const r of list) {
          this.choice.set(item, r);
          if (this.feedback(item, item, 1, new Set(), new Set()) < 1 - 1e-9) { picked = r; break; }
        }
        if (picked) this.choice.set(item, picked);
        else this.choice.delete(item);
      }
    }
  }

  /**
   * How much of `target` the chain below `it` feeds back per `rate` of `it` (cycles like seed -> plant -> seed).
   * Loops through items on the outer path are handled (scaled) at that outer item, so they count 0 here.
   */
  private feedback(target: string, it: string, rate: number, seen: Set<string>, outer: Set<string>): number {
    if (seen.size && it === target) return rate;
    if (seen.has(it) || outer.has(it)) return 0;
    const recipe = this.recipeFor(it);
    if (!recipe) return 0;
    const cycles = rate / recipe.products.find((p) => p.item === it)!.count;
    const next = new Set(seen).add(it);
    return recipe.ingredients.reduce((s, ing) => s + this.feedback(target, ing.item, ing.count * cycles, next, outer), 0);
  }

  producible(item: string) {
    return this.choice.has(item);
  }

  items() {
    return [...this.choice.keys()];
  }

  recipeFor(item: string): Recipe | undefined {
    return this.choice.get(item);
  }

  solve(item: string, ratePerMin: number): ChainResult {
    const machines = new Map<string, number>();
    const raw = new Map<string, number>();
    const frac = new Map<string, number>();

    const walk = (it: string, rate: number, path: Set<string>): ChainNode => {
      if (path.has(it)) {
        return { item: it, rate, machines: 0, byproducts: [], inputs: [], loop: true };
      }
      const recipe = this.recipeFor(it);
      if (!recipe) {
        raw.set(it, (raw.get(it) ?? 0) + rate);
        return { item: it, rate, machines: 0, byproducts: [], inputs: [] };
      }
      // self-feeding loop: produce rate / (1 - f) gross so `rate` is left over after feeding the loop
      const f = this.feedback(it, it, 1, new Set(), path);
      if (f > 0 && f < 1) rate = rate / (1 - f);
      const out = recipe.products.find((p) => p.item === it)!.count;
      const cyclesPerMin = rate / out;
      const perMachine = 60 / recipe.time!;
      const m = cyclesPerMin / perMachine;
      frac.set(recipe.facility, (frac.get(recipe.facility) ?? 0) + m);
      const next = new Set(path).add(it);
      return {
        item: it,
        rate,
        recipe,
        machines: m,
        byproducts: recipe.products
          .filter((p) => p.item !== it)
          .map((p) => ({ item: p.item, rate: p.count * cyclesPerMin })),
        inputs: recipe.ingredients.map((ing) => walk(ing.item, ing.count * cyclesPerMin, next)),
      };
    };

    const root = walk(item, ratePerMin, new Set());
    let power = 0;
    const unknownPower: string[] = [];
    for (const [f, m] of frac) {
      const whole = Math.ceil(m - 1e-9);
      machines.set(f, whole);
      const p = this.power.get(f);
      if (p === undefined) unknownPower.push(f);
      else power += p * whole;
    }
    return { root, machines, raw, power, unknownPower };
  }
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, ""));

/** Tree as monospace text. */
export function renderTree(node: ChainNode, prefix = "", last = true, top = true): string {
  const branch = top ? "" : last ? "└─ " : "├─ ";
  const what = node.loop
    ? `${node.item} ${fmt(node.rate)}/min ↺ (fed back from above)`
    : node.recipe
      ? `${node.item} ${fmt(node.rate)}/min ← ${node.recipe.facility} ×${fmt(node.machines)}`
      : `${node.item} ${fmt(node.rate)}/min (raw)`;
  let out = `${prefix}${branch}${what}\n`;
  const childPrefix = top ? "" : prefix + (last ? "   " : "│  ");
  node.inputs.forEach((c, i) => {
    out += renderTree(c, childPrefix, i === node.inputs.length - 1, false);
  });
  return out;
}

export { fmt as fmtRate };
