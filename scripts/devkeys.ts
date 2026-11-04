// Local testing without Discord: generates an Ed25519 keypair, writes .dev.vars with the public key
// and .dev-key.pem with the private key used by scripts/e2e.ts to sign fake interactions.
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const rawPub = publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex");
writeFileSync(".dev-key.pem", privateKey.export({ format: "pem", type: "pkcs8" }));
writeFileSync(".dev.vars", `DISCORD_PUBLIC_KEY=${rawPub}\nDISCORD_APP_ID=000000000000000000\nDISCORD_TOKEN=dev\n`);
console.log("wrote .dev.vars and .dev-key.pem");
