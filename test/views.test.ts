// Renders every entity through every view in every language and checks Discord's message limits.
import { describe, it, expect } from "vitest";
import { render, type Ctx } from "../src/views.ts";
import { data, factory } from "../src/data/index.ts";
import { LANGS } from "../src/i18n.ts";

function walk(c: any, acc: { text: number; count: number; ids: string[] }) {
  acc.count++;
  if (typeof c.content === "string") acc.text += c.content.length;
  if (c.custom_id) acc.ids.push(c.custom_id);
  for (const child of c.components ?? []) walk(child, acc);
  if (c.accessory) walk(c.accessory, acc);
  return acc;
}

describe.each(LANGS)("views stay within Discord limits (%s)", (lang) => {
  const ctx: Ctx = { lang, now: Math.floor(Date.now() / 1000), shared: false };

  function check(state: string) {
    const r = render(state, ctx);
    const acc = { text: 0, count: 0, ids: [] as string[] };
    r.components.forEach((c) => walk(c, acc));
    expect(acc.text, `${state} text`).toBeLessThanOrEqual(4000);
    expect(acc.count, `${state} components`).toBeLessThanOrEqual(40);
    for (const id of acc.ids) {
      expect(id.length, `${state} custom_id ${id}`).toBeLessThanOrEqual(100);
      // every button must render too
      if (!id.startsWith("pub|") && !id.startsWith("fam|")) render(id, ctx);
    }
    return r;
  }

  it("operators, all tabs", { timeout: 30000 }, () => {
    for (const o of data.operators) for (const t of ["o", "s", "t", "m"]) check(`op|${o.name}|${t}`);
  });
  it("weapons, gear, sets, enemies", { timeout: 30000 }, () => {
    data.weapons.forEach((w) => check(`wp|${w.name}`));
    data.gear.forEach((g) => check(`gr|${g.name}`));
    data.sets.forEach((s) => check(`gr|${s.name}`));
    data.enemies.forEach((e) => check(`en|${e.name}`));
  });
  it("items and recipes", { timeout: 30000 }, () => {
    data.items.forEach((i) => check(`it|${i.name}`));
  });
  it("factory for every producible item", { timeout: 30000 }, () => {
    for (const item of factory.items()) check(`fa|${item}|30`);
  });
  it("timers", () => {
    for (const s of ["AMEU", "ASIA"]) {
      check(`bn|${s}`);
      check(`ev|${s}`);
    }
    check("rs");
    check("hp");
  });
});
