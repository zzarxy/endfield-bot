// Live wiki search for /wiki (CirrusSearch + page descriptions).
import { BRAND_COLOR, button, clip, container, footer, linkButton, row, separator, text, wikiUrl, type Component } from "./lib/ui.ts";
import { ButtonStyle } from "discord-api-types/v10";
import { data } from "./data/index.ts";

const API = "https://endfield.wiki.gg/api.php";
const UA = "EndfieldDiscordBot/0.1 (https://github.com/zzarxy)";

async function api(params: Record<string, string>, timeoutMs = 2000): Promise<any> {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const res = await fetch(`${API}?${qs}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
    cf: { cacheTtl: 3600, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) throw new Error(`wiki ${res.status}`);
  return res.json();
}

export async function suggest(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  const json = await api({ action: "opensearch", search: query, limit: "20", namespace: "0", redirects: "resolve" }, 1500);
  return (json[1] as string[]) ?? [];
}

export async function wikiCard(query: string, shared: boolean): Promise<{ components: Component[] }> {
  const json = await api({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "5",
    prop: "pageprops",
    ppprop: "description",
  });
  const pages = ((json.query?.pages ?? []) as any[]).sort((a, b) => a.index - b.index);
  if (!pages.length) {
    return {
      components: [container(0xed4245, [text(`No wiki pages found for **${query}**.`), row(linkButton("Search on wiki", `https://endfield.wiki.gg/index.php?search=${encodeURIComponent(query)}`))])],
    };
  }
  const [top, ...rest] = pages;
  const inner: Component[] = [
    text(`## ${top.title}\n${clip(top.pageprops?.description ?? "", 1500)}`),
  ];
  if (rest.length) {
    inner.push(separator(), text("**Also:** " + rest.map((p) => `[${p.title}](${wikiUrl(p.title)})`).join(" · ")));
  }
  inner.push(separator(), footer(data.syncedAt));
  const actions = [linkButton("Open page", wikiUrl(top.title))];
  if (!shared) actions.push(button("Show everyone", `pub|wk|${top.title}`.slice(0, 100), { style: ButtonStyle.Success }));
  inner.push(row(...actions));
  return { components: [container(BRAND_COLOR, inner)] };
}
