import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";

const evidence="verified evidence payload";
const hash="0x"+createHash("sha256").update(evidence).digest("hex");
assert.match(hash,/^0x[0-9a-f]{64}$/);

const allowedEnv=["INTERN_WORK_API_URL","INTERN_WORK_API_TOKEN"];
assert.equal(allowedEnv.includes("PRIVATE_KEY"),false);
assert.equal(allowedEnv.includes("MNEMONIC"),false);
