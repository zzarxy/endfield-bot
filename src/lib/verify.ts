// Discord request signature check (Ed25519 over timestamp + body) using WebCrypto.

const hexToBytes = (hex: string) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const keyCache = new Map<string, Promise<CryptoKey>>();

function importKey(publicKeyHex: string) {
  let key = keyCache.get(publicKeyHex);
  if (!key) {
    key = crypto.subtle.importKey("raw", hexToBytes(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
    keyCache.set(publicKeyHex, key);
  }
  return key;
}

export async function verifyDiscordRequest(
  body: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyHex: string,
): Promise<boolean> {
  if (!signature || !timestamp || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  try {
    const key = await importKey(publicKeyHex);
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}
