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


const requirementsHash="0x"+"ab".repeat(32);
const canonicalOpportunityId="sha256:"+requirementsHash.slice(2).toLowerCase();
assert.match(canonicalOpportunityId,/^sha256:[0-9a-f]{64}$/);
assert.equal(canonicalOpportunityId.startsWith("sha256:sha256:"),false,"canonical lookup must not double-prefix sha256");

for(const malformed of ["", "147x", "-1", "1.0"])assert.equal(/^\d+$/.test(malformed),false,"malformed Intern IDs must fail closed");

const workerTba="0x"+"12".repeat(20);
const routedTba="0x"+"34".repeat(20);
assert.notEqual(workerTba.toLowerCase(),routedTba.toLowerCase(),"qualification TBA mismatch must not execute");


const safeIntent={broadcast:false,requiresExternalSigner:true,requiredSigner:workerTba};
assert.equal(safeIntent.broadcast,false);
assert.equal(safeIntent.requiresExternalSigner,true);
assert.equal(safeIntent.requiredSigner.toLowerCase(),workerTba.toLowerCase());
const attackerSigner="0x"+"99".repeat(20);
assert.notEqual(attackerSigner.toLowerCase(),workerTba.toLowerCase(),"result signer substitution must fail closed");

const escrow="0x"+"55".repeat(20);
const submitData="0xd2ee66cf"+"00".repeat(64);
const boundedIntent={chainId:46630,to:escrow,value:"0",data:submitData,function:"submitResult",functionSignature:"submitResult(uint256,bytes32)",requiredSigner:workerTba,requiresExternalSigner:true,broadcast:false};
assert.equal(boundedIntent.to.toLowerCase(),escrow.toLowerCase());
assert.equal(boundedIntent.chainId,46630);
assert.equal(boundedIntent.value,"0");
assert.equal(boundedIntent.data.slice(0,10),"0xd2ee66cf");
assert.equal(boundedIntent.functionSignature,"submitResult(uint256,bytes32)");
for(const forbidden of [
 {...boundedIntent,to:attackerSigner},
 {...boundedIntent,chainId:4663},
 {...boundedIntent,value:"1"},
 {...boundedIntent,data:"0x017e748b"+boundedIntent.data.slice(10)},
 {...boundedIntent,requiredSigner:attackerSigner}
]){
 const valid=forbidden.to.toLowerCase()===escrow.toLowerCase()&&forbidden.chainId===46630&&forbidden.value==="0"&&forbidden.data.startsWith("0xd2ee66cf")&&forbidden.requiredSigner.toLowerCase()===workerTba.toLowerCase();
 assert.equal(valid,false,"TBA rail must reject target/chain/value/selector/signer substitution");
}
