import { describe, it, expect } from "vitest";
import { parseLuaData } from "../pipeline/lua.ts";
import { templates, clean, materials, lead } from "../pipeline/wikitext.ts";
import { Factory } from "../src/lib/factory.ts";
import { nextDailyReset, nextWeeklyReset } from "../src/lib/time.ts";
import { search, findExact } from "../src/lib/search.ts";

describe("lua", () => {
  it("parses recipe modules", () => {
    const src = `local data = {
{
    time = 2,
    mode = "Fluid", -- comment
    event = false,
    ingredients = { { item = "Cuprium Ore", count = 1 }, { item = "Clean Water", count = 1 } },
    products = { { item = "Cuprium", count = 1 } },
    facility = "Refining Unit",
},
}
return data`;
    expect(parseLuaData(src)).toEqual([
      {
        time: 2, mode: "Fluid", event: false,
        ingredients: [{ item: "Cuprium Ore", count: 1 }, { item: "Clean Water", count: 1 }],
        products: [{ item: "Cuprium", count: 1 }],
        facility: "Refining Unit",
      },
    ]);
  });
});

describe("wikitext", () => {
  it("extracts nested template params", () => {
    const t = "x {{Combat skill\n|name= Seek\n|type= {{SB|1}}\n|desc= deals {{Color|Physical DMG|1}} to [[Enemy|foes]]\n}} y";
    const [p] = templates(t, "Combat skill");
    expect(p.name).toBe("Seek");
    expect(p.type).toBe("{{SB|1}}");
    expect(clean(p.desc)).toBe("deals **Physical DMG** to foes");
  });
  it("cleans html and item templates", () => {
    expect(clean("<b>A:</b><br />{{I|Cast Die|5}} {{G|Electrification|Electrification}}")).toBe("**A:**\nCast Die ×5 Electrification");
  });
  it("parses material lists", () => {
    expect(materials("Protodisk x8, T-Creds x1600")).toEqual([
      { item: "Protodisk", count: 8 },
      { item: "T-Creds", count: 1600 },
    ]);
  });
  it("lead skips infobox closing on the same line", () => {
    expect(lead("{{Weapon infobox\n|name = X\n|source = Y}}\n'''X''' is a sword.\n\n==Stats==")).toBe("**X** is a sword.");
  });
});

describe("factory", () => {
  const f = new Factory(
    [
      { facility: "Refining Unit", time: 2, ingredients: [{ item: "Ore", count: 1 }], products: [{ item: "Ingot", count: 1 }] },
      { facility: "Fitting Unit", time: 10, ingredients: [{ item: "Ingot", count: 2 }], products: [{ item: "Part", count: 1 }] },
    ],
    [{ name: "Refining Unit", power: 5 }, { name: "Fitting Unit", power: 20 }],
  );
  it("computes machines, raw input and power", () => {
    const r = f.solve("Part", 12); // 12/min parts -> 2 fitting units (6/min each), 24 ingots/min -> 0.8 refining
    expect(r.root.machines).toBeCloseTo(2);
    expect(r.root.inputs[0].machines).toBeCloseTo(0.8);
    expect(r.raw.get("Ore")).toBeCloseTo(24);
    expect(r.machines.get("Refining Unit")).toBe(1);
    expect(r.power).toBe(2 * 20 + 5);
  });
});

describe("time", () => {
  const ameu = { id: "AMEU" as const, name: "Americas / Europe", utcOffsetMin: -300 };
  const asia = { id: "ASIA" as const, name: "Asia", utcOffsetMin: 480 };
  const t = Date.UTC(2026, 10, 5, 12, 0, 0) / 1000; // Thu 12:00 UTC
  it("daily reset is 04:00 local", () => {
    expect(new Date(nextDailyReset(ameu, t) * 1000).toISOString()).toBe("2026-11-06T09:00:00.000Z");
    expect(new Date(nextDailyReset(asia, t) * 1000).toISOString()).toBe("2026-11-05T20:00:00.000Z");
  });
  it("weekly reset is Monday 04:00 local", () => {
    expect(new Date(nextWeeklyReset(ameu, t) * 1000).toISOString()).toBe("2026-11-09T09:00:00.000Z");
    expect(new Date(nextWeeklyReset(asia, t) * 1000).toISOString()).toBe("2026-11-08T20:00:00.000Z"); // Mon 04:00 UTC+8
  });
});

describe("search", () => {
  const list = [{ name: "Arclight", names: { ru: "Арклайт" } }, { name: "Ardelia" }, { name: "Chen Qianyu" }];
  it("prefix, word and typo matches", () => {
    expect(search(list, "ar").map((x) => x.name).sort()).toEqual(["Arclight", "Ardelia"]);
    expect(search(list, "qian")[0].name).toBe("Chen Qianyu");
    expect(findExact(list, "arclght")?.name).toBe("Arclight");
    expect(findExact(list, "арклайт")?.name).toBe("Arclight");
  });
});

describe("factory loops", () => {
  const f = new Factory(
    [
      { facility: "Planting Unit", time: 2, ingredients: [{ item: "Seed", count: 1 }], products: [{ item: "Leaf", count: 2 }] },
      { facility: "Seed-Picking Unit", time: 2, ingredients: [{ item: "Leaf", count: 1 }], products: [{ item: "Seed", count: 2 }] },
      { facility: "Filling Unit", time: 2, ingredients: [{ item: "Bottle", count: 1 }, { item: "Water", count: 1 }], products: [{ item: "Bottle (Water)", count: 1 }] },
      { facility: "Separating Unit", time: 2, ingredients: [{ item: "Bottle (Water)", count: 1 }], products: [{ item: "Water", count: 1 }, { item: "Bottle", count: 1 }] },
    ],
    [],
  );
  it("scales a seed loop so the net output matches the target", () => {
    // 1 seed -> 2 leaf; 1 leaf -> 2 seed: per leaf produced, 0.25 leaf is fed back
    const r = f.solve("Leaf", 30);
    expect(r.root.rate).toBeCloseTo(40);
    const loop = r.root.inputs[0].inputs[0];
    expect(loop.loop).toBe(true);
    expect(loop.rate).toBeCloseTo(10);
    expect(r.raw.size).toBe(0);
  });
  it("does not source a fluid by un-bottling", () => {
    expect(f.producible("Water")).toBe(false);
  });
});

describe("notifications", async () => {
  const { dueFor } = await import("../src/notify.ts");
  const { data } = await import("../src/data/index.ts");
  const banner = data.timeline.find((e) => e.kind === "banner" && e.ameu && e.rateUp)!;
  const sub = { id: 1, guild_id: "g", channel_id: "c", server: "AMEU" as const, lang: "en" as const, role_id: null, banners: 1, events: 0, resets: 0, failures: 0 };
  it("announces a banner shortly after it starts, once per key", () => {
    const due = dueFor(sub, banner.ameu!.start + 600);
    expect(due.map((d) => d.key)).toContain(`b:${banner.name}:start`);
    expect(dueFor(sub, banner.ameu!.start - 600).map((d) => d.key)).not.toContain(`b:${banner.name}:start`);
    expect(dueFor(sub, banner.ameu!.start + 7 * 3600).map((d) => d.key)).not.toContain(`b:${banner.name}:start`);
  });
  it("respects disabled kinds", () => {
    expect(dueFor({ ...sub, banners: 0 }, banner.ameu!.start + 600).some((d) => d.key.startsWith("b:"))).toBe(false);
  });
});

describe("i18n", async () => {
  const { localeToLang, LANGS, STR, DISCORD_LOCALES, t } = await import("../src/i18n.ts");
  const { COMMANDS } = await import("../src/commands.ts");
  const { data, localName } = await import("../src/data/index.ts");
  const { dueFor } = await import("../src/notify.ts");
  const { choices } = await import("../src/lib/search.ts");

  it("maps Discord locales to supported languages", () => {
    expect(localeToLang("en-US")).toBe("en");
    expect(localeToLang("en-GB")).toBe("en");
    expect(localeToLang("ru")).toBe("ru");
    expect(localeToLang("uk")).toBe("uk");
    expect(localeToLang("es-ES")).toBe("es");
    expect(localeToLang("es-419")).toBe("es");
    expect(localeToLang("ja")).toBe("ja");
    expect(localeToLang("ko")).toBe("ko");
    expect(localeToLang("zh-CN")).toBe("zh");
    expect(localeToLang("zh-TW")).toBe("tc");
    expect(localeToLang("de")).toBe("en");
    expect(localeToLang(undefined)).toBe("en");
  });

  it("every dictionary is complete and keeps the same placeholders", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    for (const lang of LANGS) {
      for (const [key, en] of Object.entries(STR.en)) {
        const v = (STR[lang] as Record<string, string>)[key];
        expect(v, `${lang}.${key}`).toBeTruthy();
        expect(placeholders(v), `${lang}.${key} placeholders`).toBe(placeholders(en));
      }
    }
  });

  it("slash command texts fit Discord limits and use valid locale codes", () => {
    const valid = new Set(Object.values(DISCORD_LOCALES).flat());
    const visit = (c: any) => {
      expect(c.name.length).toBeLessThanOrEqual(32);
      expect(c.description.length, c.name).toBeLessThanOrEqual(100);
      for (const [code, text] of Object.entries(c.description_localizations ?? {})) {
        expect(valid.has(code), `${c.name} ${code}`).toBe(true);
        expect((text as string).length, `${c.name} ${code}`).toBeLessThanOrEqual(100);
      }
      (c.options ?? []).forEach(visit);
    };
    COMMANDS.forEach(visit);
  });

  it("wiki gives localized names for the six wiki languages", () => {
    const langs = ["ru", "es", "ja", "ko", "zh", "tc"] as const;
    // some operators keep their English name in Spanish, so pick one that differs in every language
    const op = data.operators.find((o) => langs.every((l) => o.names?.[l]))!;
    expect(op).toBeTruthy();
    for (const lang of langs) {
      const local = op.names![lang]!;
      // typing the local name finds the operator and shows it next to the English one
      const hit = choices(data.operators, local, lang)[0];
      expect(hit.value).toBe(op.name);
      expect(hit.name).toBe(`${op.name} · ${local}`);
      expect(localName(op.name, lang)).toBe(local);
    }
    expect(localName(op.name, "en")).toBe(op.name);
    expect(localName(op.name, "uk")).toBe(op.name); // no Ukrainian names on the wiki
  });

  it("notifications are written in the subscription language", () => {
    const banner = data.timeline.find((e) => e.kind === "banner" && e.ameu && e.rateUp)!;
    const sub = { id: 1, guild_id: "g", channel_id: "c", server: "AMEU" as const, lang: "ja" as const, role_id: null, banners: 1, events: 0, resets: 0, failures: 0 };
    const due = dueFor(sub, banner.ameu!.start + 600).find((d) => d.key === `b:${banner.name}:start`)!;
    expect(JSON.stringify(due.components)).toContain(t("ja", "nt_new_banner"));
  });
});

describe("legal pages", async () => {
  const { legalPage } = await import("../src/legal.ts");
  it("serves privacy and terms, nothing else", () => {
    expect(legalPage("/privacy")).toContain("/privacy-delete");
    expect(legalPage("/terms/")).toContain("not affiliated");
    expect(legalPage("/")).toBeNull();
    expect(legalPage("/other")).toBeNull();
  });
});
