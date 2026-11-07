// Shapes of the JSON produced by pipeline/sync.ts and bundled into the worker.

import type { Lang } from "../i18n.ts";

/** Localized names from the wiki (Locales table); English is the entity's own `name`. */
export type Names = Partial<Record<Lang, string>>;

export interface Mat { item: string; count: number }

export interface SkillStat { name: string; lv1: string; max: string }
export interface Skill { name: string; type: string; desc: string; stats: SkillStat[] }
export interface Talent { name: string; levels: { cond: string; desc: string }[] }
export interface Potential { n: number; title: string; desc: string }

export interface Operator {
  name: string;
  names?: Names;
  rarity: number;
  class: string;
  weapon: string;
  element: string;
  faction: string;
  tags: string[];
  main: string;
  sub: string;
  quote: string;
  summary: string;
  icon?: string;
  splash?: string;
  banner?: string; // wide (900x352) card art
  maxStats: Record<string, string>;
  promotions: { stage: number; mats: Mat[] }[];
  potentials: Potential[];
  skills: Skill[];
  talents: Talent[];
  skillLevelMats: Mat[]; // total for one skill Lv1 -> Lv9 (shared levels)
  masteryMats: Mat[]; // total for one skill Lv9 -> Lv12
  synergy: string[];
}

export interface Weapon {
  name: string;
  names?: Names;
  rarity: number;
  type: string;
  source: string;
  summary: string;
  icon?: string;
  baseAtk: string; // lv1 -> max
  skills: string[];
  potential: string;
  ascension: { stage: number; mats: Mat[] }[];
}

export interface Gear {
  name: string;
  names?: Names;
  rarity: number;
  type: string;
  level: number;
  set: string;
  source: string;
  defense?: number;
  stats: { stat: string; values: number[] }[];
  icon?: string;
}

export interface GearSet { name: string; names?: Names; level: number; effect: string; pieces: string[]; icon?: string }

export interface Item {
  name: string;
  names?: Names;
  rarity: number;
  type: string;
  use: string;
  desc: string;
  icon?: string;
}

export interface Enemy { name: string; names?: Names; type: string; class: string; summary: string; image?: string }

export interface Recipe {
  facility: string; // machine name, or "Crafting" for manual crafting
  time?: number; // seconds per cycle
  mode?: string;
  ingredients: Mat[];
  products: Mat[];
}

export interface Facility { name: string; names?: Names; power?: number; icon?: string }

export interface TimedEntry {
  name: string;
  kind: "banner" | "event" | "version";
  type?: string;
  rateUp?: string;
  image?: string;
  // unix seconds per server
  asia?: { start: number; end: number };
  ameu?: { start: number; end: number };
}

export interface Server { id: "ASIA" | "AMEU"; name: string; utcOffsetMin: number }

export interface Dataset {
  syncedAt: string;
  operators: Operator[];
  weapons: Weapon[];
  gear: Gear[];
  sets: GearSet[];
  items: Item[];
  enemies: Enemy[];
  recipes: Recipe[];
  facilities: Facility[];
  timeline: TimedEntry[];
  servers: Server[];
}
