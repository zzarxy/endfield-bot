// Components V2 builders. Everything the bot shows is a single Container with an accent colour.
import { t, type Lang } from "../i18n.ts";
import { ComponentType, ButtonStyle, MessageFlags, SeparatorSpacingSize } from "discord-api-types/v10";

export const FLAG_V2 = MessageFlags.IsComponentsV2;
export const FLAG_EPHEMERAL = MessageFlags.Ephemeral;
export const TEXT_LIMIT = 3800; // total text budget per message (Discord cap is 4000)

export const RARITY_COLOR: Record<number, number> = {
  6: 0xff7a1a,
  5: 0xffc531,
  4: 0xa77bff,
  3: 0x3fa7ff,
  2: 0x9acd32,
  1: 0xaaaaaa,
};
export const BRAND_COLOR = 0xfff200;

export const WIKI = "https://endfield.wiki.gg/wiki/";
export const wikiUrl = (page: string) => WIKI + encodeURIComponent(page.replace(/ /g, "_")).replace(/%2F/g, "/");
export const fileUrl = (file?: string) =>
  file ? `https://endfield.wiki.gg/images/${encodeURIComponent(file.replace(/ /g, "_"))}` : undefined;

export const stars = (n: number) => (n > 0 ? "★".repeat(n) : "");

export type Component = Record<string, unknown>;

export const text = (content: string): Component => ({ type: ComponentType.TextDisplay, content });

export const separator = (big = false): Component => ({
  type: ComponentType.Separator,
  divider: true,
  spacing: big ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small,
});

/** Text block with an optional thumbnail on the right. */
export function section(content: string, thumbnail?: string): Component {
  if (!thumbnail) return text(content);
  return {
    type: ComponentType.Section,
    components: [text(content)],
    accessory: { type: ComponentType.Thumbnail, media: { url: thumbnail } },
  };
}

/** Full-width image (wide art is shown uncropped, unlike a Thumbnail). */
export const gallery = (url: string): Component => ({
  type: ComponentType.MediaGallery,
  items: [{ media: { url } }],
});

export function button(label: string, customId: string, opts: { active?: boolean; style?: ButtonStyle } = {}): Component {
  return {
    type: ComponentType.Button,
    style: opts.style ?? (opts.active ? ButtonStyle.Primary : ButtonStyle.Secondary),
    label,
    custom_id: customId.slice(0, 100),
    disabled: !!opts.active,
  };
}

export const linkButton = (label: string, url: string): Component => ({
  type: ComponentType.Button,
  style: ButtonStyle.Link,
  label,
  url,
});

export const row = (...components: Component[]): Component => ({ type: ComponentType.ActionRow, components });

export function container(accent: number, components: Component[]): Component {
  return { type: ComponentType.Container, accent_color: accent, components };
}

export const footer = (syncedAt: string, lang: Lang) => text(t(lang, "footer", { date: syncedAt.slice(0, 10) }));

/** Cut text to a budget on a line boundary. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const nl = cut.lastIndexOf("\n");
  return (nl > max * 0.6 ? cut.slice(0, nl) : cut.slice(0, max - 1)) + "…";
}

export const fmtMats = (mats: { item: string; count: number }[], nameOf: (n: string) => string = (n) => n) =>
  mats.map((m) => `${nameOf(m.item)} ×${m.count.toLocaleString("en-US")}`).join(", ");

export const ts = (unix: number, style: "R" | "f" | "F" | "t" | "d" = "f") => `<t:${unix}:${style}>`;
