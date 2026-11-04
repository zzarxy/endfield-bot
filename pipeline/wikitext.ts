// Minimal wikitext helpers: pull template parameters and turn markup into Discord markdown.

export type Params = Record<string, string>;

/** All top-level occurrences of {{name ...}} with their named params. */
export function templates(text: string, name: string): Params[] {
  const out: Params[] = [];
  const re = new RegExp(`\\{\\{\\s*${name.replace(/ /g, "[ _]")}\\s*(\\||\\}\\})`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    let depth = 0;
    let i = start;
    for (; i < text.length - 1; i++) {
      const two = text.slice(i, i + 2);
      if (two === "{{" || two === "[[") { depth++; i++; }
      else if (two === "}}" || two === "]]") { depth--; i++; if (depth === 0) break; }
    }
    const body = text.slice(start + 2, i - 1);
    out.push(splitParams(body));
    re.lastIndex = i;
  }
  return out;
}

function splitParams(body: string): Params {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth++; cur += two; i++; continue; }
    if (two === "}}" || two === "]]") { depth--; cur += two; i++; continue; }
    if (body[i] === "|" && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  parts.push(cur);
  const params: Params = {};
  parts.slice(1).forEach((p, idx) => {
    const eq = p.indexOf("=");
    if (eq > 0 && !p.slice(0, eq).includes("{{")) params[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
    else params[String(idx + 1)] = p.trim();
  });
  return params;
}

/** Wikitext/HTML -> Discord markdown (bold kept, links and colour templates flattened). */
export function clean(s: string | undefined): string {
  if (!s) return "";
  let t = s;
  for (let pass = 0; pass < 4; pass++) {
    t = t
      .replace(/\{\{\s*Color\s*\|([^{}|]*)(\|[^{}]*)?\}\}/gi, "**$1**")
      .replace(/\{\{\s*G\s*\|([^{}|]*)\|([^{}|]*)\}\}/gi, "$2")
      .replace(/\{\{\s*G\s*\|([^{}|]*)\}\}/gi, "$1")
      .replace(/\{\{\s*(?:I|Item)\s*\|([^{}|]*)\|(\d+)[^{}]*\}\}/gi, "$1 ×$2")
      .replace(/\{\{\s*(?:I|Item)\s*\|([^{}|]*)(\|[^{}]*)?\}\}/gi, "$1")
      .replace(/\{\{[^{}]*\}\}/g, "");
  }
  t = t
    .replace(/\[\[File:[^\]]*\]\]/gi, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+ ([^\]]+)\]/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?b>/gi, "**")
    .replace(/<span[^>]*>|<\/span>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/'''([^']+)'''/g, "**$1**")
    .replace(/''([^']+)''/g, "*$1*")
    .replace(/\*\*\*\*/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

/** "Protodisk x8, Pink Bolete x3" -> [{item, count}] */
export function materials(s: string | undefined): { item: string; count: number }[] {
  if (!s) return [];
  return s
    .split(",")
    .map((p) => p.trim().match(/^(.*?)\s*x\s*([\d.]+)$/i))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ item: m[1].trim(), count: Number(m[2]) }));
}

/** First prose paragraph after templates (fallback summary). */
export function lead(text: string): string {
  let i = 0;
  // skip leading templates by brace depth (infoboxes may close on the same line as the last param)
  for (;;) {
    while (/\s/.test(text[i] ?? "")) i++;
    if (!text.startsWith("{{", i)) break;
    let depth = 0;
    for (; i < text.length - 1; i++) {
      const two = text.slice(i, i + 2);
      if (two === "{{") { depth++; i++; }
      else if (two === "}}") { depth--; i++; if (depth === 0) { i++; break; } }
    }
  }
  const para = text.slice(i).split(/\n==/)[0];
  return clean(para).split("\n\n")[0] ?? "";
}
