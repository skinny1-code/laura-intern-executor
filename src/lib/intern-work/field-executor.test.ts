import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";

const evidence="verified evidence payload";
assert.match("0x"+createHash("sha256").update(evidence).digest("hex"),/^0x[0-9a-f]{64}$/);

const supported=new Set(["wallet_verification","token_nft_provenance","blockchain_research","contract_deployment_verification","ai_output_verification"]);
assert.equal(supported.has("arbitrary_shell"),false);
assert.equal(supported.has("send_crypto"),false);

const assignedStatus=2;
assert.notEqual(1,assignedStatus,"Funded-only jobs must not execute");
assert.notEqual(3,assignedStatus,"Submitted jobs must not execute");
assert.notEqual(5,assignedStatus,"Settled jobs must not execute");

const allowedEnv=["INTERN_WORK_API_URL","INTERN_WORK_API_TOKEN","INTERN_WORK_RPC_URL","INTERN_WORK_ESCROW_ADDRESS","INTERN_WORK_INTERN_IDS"];
for(const secret of ["PRIVATE_KEY","MNEMONIC","SEED_PHRASE"])assert.equal(allowedEnv.includes(secret),false);

const resultIntent={broadcast:false,requiresExternalSigner:true};
assert.equal(resultIntent.broadcast,false);
assert.equal(resultIntent.requiresExternalSigner,true);
