// Parses the data-only Lua tables used by Module:Recipe/* ("local data = { ... } return data").

type Lua = string | number | boolean | null | Lua[] | { [k: string]: Lua };

export function parseLuaData(src: string): Lua {
  const start = src.indexOf("{");
  if (start < 0) throw new Error("no table in module");
  let i = start;

  const ws = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith("--", i)) { while (i < src.length && src[i] !== "\n") i++; continue; }
      return;
    }
  };

  const value = (): Lua => {
    ws();
    const c = src[i];
    if (c === "{") return table();
    if (c === '"' || c === "'") return str();
    const m = /^(-?\d+(?:\.\d+)?)|^(true|false|nil)/.exec(src.slice(i, i + 32));
    if (!m) throw new Error(`unexpected token at ${i}: ${src.slice(i, i + 20)}`);
    i += m[0].length;
    if (m[1] !== undefined) return Number(m[1]);
    return m[2] === "nil" ? null : m[2] === "true";
  };

  const str = (): string => {
    const q = src[i++];
    let s = "";
    while (src[i] !== q) {
      if (src[i] === "\\") { s += src[i + 1]; i += 2; } else s += src[i++];
    }
    i++;
    return s;
  };

  const table = (): Lua => {
    i++; // {
    const arr: Lua[] = [];
    const obj: Record<string, Lua> = {};
    let isObj = false;
    for (;;) {
      ws();
      if (src[i] === "}") { i++; break; }
      const key = /^([A-Za-z_]\w*)\s*=/.exec(src.slice(i, i + 64));
      const bracket = /^\[\s*("([^"]*)"|'([^']*)')\s*\]\s*=/.exec(src.slice(i, i + 200));
      if (key) { i += key[0].length; obj[key[1]] = value(); isObj = true; }
      else if (bracket) { i += bracket[0].length; obj[bracket[2] ?? bracket[3]] = value(); isObj = true; }
      else arr.push(value());
      ws();
      if (src[i] === "," || src[i] === ";") i++;
    }
    return isObj ? obj : arr;
  };

  return value();
}
