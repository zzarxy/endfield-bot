// Polite client for endfield.wiki.gg: one request at a time, descriptive UA, retries on 429/5xx.
const API = "https://endfield.wiki.gg/api.php";
const UA = "EndfieldDiscordBot/0.1 (data sync; https://github.com/zzarxy)";

async function get(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const wait = Number(res.headers.get("retry-after") ?? 0) * 1000 || 2000 * (attempt + 1);
    await new Promise((r) => setTimeout(r, wait));
    return get(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

async function api(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const json: any = await (await get(`${API}?${qs}`)).json();
  if (json.error) throw new Error(`${json.error.code}: ${json.error.info} (${qs})`);
  return json;
}

/** Fetch all rows of a Cargo table (paged by 500). */
export async function cargo(table: string, fields: string[], where?: string): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = [];
  for (let offset = 0; ; offset += 500) {
    const json = await api({
      action: "cargoquery",
      tables: table,
      fields: fields.join(","),
      limit: "500",
      offset: String(offset),
      ...(where ? { where } : {}),
    });
    const batch = (json.cargoquery as { title: Record<string, string> }[]).map((r) => r.title);
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}

/** Raw page source (modules or articles). */
export async function raw(title: string): Promise<string> {
  return (await get(`https://endfield.wiki.gg/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}?action=raw`)).text();
}

/** Wikitext of many pages, 50 per request. Missing pages are skipped. */
export async function wikitexts(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const json = await api({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      redirects: "1",
      titles: titles.slice(i, i + 50).join("|"),
    });
    const redirects = new Map<string, string>((json.query.redirects ?? []).map((r: any) => [r.to, r.from]));
    for (const p of json.query.pages) {
      const text = p.revisions?.[0]?.slots?.main?.content;
      if (text) out.set(redirects.get(p.title) ?? p.title, text);
    }
  }
  return out;
}

/** Short page descriptions (Description2 pageprop), 50 per request. */
export async function descriptions(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const json = await api({
      action: "query",
      prop: "pageprops",
      ppprop: "description",
      redirects: "1",
      titles: titles.slice(i, i + 50).join("|"),
    });
    const redirects = new Map<string, string>((json.query.redirects ?? []).map((r: any) => [r.to, r.from]));
    for (const p of json.query.pages) {
      const d = p.pageprops?.description;
      if (d) out.set(redirects.get(p.title) ?? p.title, d);
    }
  }
  return out;
}

export async function modules(prefix: string): Promise<string[]> {
  const json = await api({ action: "query", list: "allpages", apnamespace: "828", apprefix: prefix, aplimit: "500" });
  return json.query.allpages.map((p: any) => p.title as string);
}
