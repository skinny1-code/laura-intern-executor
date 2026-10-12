import test from "node:test";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {executeWalletVerification,assertJob,STAGING,type Job,type ChainEvidence} from "./execute";

const ID="agentjob:"+"2e76eb74103f0f0e7e85063e5285c863329606f29904544bfdd605131e4cbeca";
const BUYER="0x30b2fe82f904910065eeecb71bb3665937fb1de7";
const HASH="0x"+"12".repeat(32);
const job:Job={
 id:ID,title:"Test2",description:"Test2",serviceId:"wallet_verification",
 clientAddress:BUYER,status:"ASSIGNED",
 budgetWei:"100000000000000000000",serviceHash:HASH,requirementsHash:HASH,
 acceptedWorker:{internId:"3536",tba:STAGING.payoutAccount},
 onchain:{chainId:46630,escrow:STAGING.escrow,jobId:"3",fundTx:HASH}
};
const evidence:ChainEvidence={
 currentOwner:STAGING.owner,escrowClient:BUYER,escrowWorkerTba:STAGING.payoutAccount,
 escrowIntern:"3536",escrowStatus:2,escrowServiceHash:HASH,
 escrowRequirementsHash:HASH,escrowAmount:job.budgetWei,escrowDeadline:5000000000,
 wallet:{chainId:46630,address:BUYER,blockNumber:"100",blockTimestamp:1000,
 nativeBalanceWei:"1000000000000000000",transactionCount:2,codeBytes:0}
};
const text="The hiring wallet exists on Robinhood testnet with the stated on-chain balance and transaction count. This evidence does not establish identity or safety.";
const deps={
 getJob:async()=>job,getEvidence:async()=>evidence,
 summarize:async()=>({text,modelId:"test-real-model",usedMock:false})
};
test("Test2 is bound to assigned NFT and defaults ONLY to authenticated hiring wallet",()=>{
 const target=assertJob(job,"3536");
 assert.equal(target.address.toLowerCase(),BUYER.toLowerCase());
 assert.equal(target.source,"authenticated_hiring_wallet_fallback");
});
test("LAURA report is deterministically hashed, captures evidence and never signs",async()=>{
 const out=await executeWalletVerification({boardJobId:ID,internId:"3536"},deps);
 assert.equal(out.report.boardJobId,ID);
 assert.equal(out.report.internId,"3536");
 assert.equal(out.report.onchainJobId,"3");
 assert.equal(out.report.target.source,"authenticated_hiring_wallet_fallback");
 assert.equal(out.report.evidence.wallet.nativeBalanceWei,"1000000000000000000");
 assert.match(out.resultHash,/^0x[0-9a-f]{64}$/);
 assert.match(out.evidenceSha256,/^[0-9a-f]{64}$/);
 assert.equal(JSON.stringify(out.report),out.reportJson);
 assert.equal((await executeWalletVerification({boardJobId:ID,internId:"3536"},deps)).resultHash,out.resultHash);
});
test("LAURA cannot claim work from simulated/mock LLM results",async()=>{
 await assert.rejects(()=>executeWalletVerification({boardJobId:ID,internId:"3536"},{
   ...deps,summarize:async()=>({text,modelId:"mock",usedMock:true})
 }),/REAL_LAURA_INFERENCE_REQUIRED/);
});
test("LAURA refuses an unrelated or unstaged onchain assignment",async()=>{
 for(const bad of [
   {...job,status:"FUNDED"}, {...job,acceptedWorker:{internId:"147",tba:STAGING.payoutAccount}},
   {...job,serviceId:"blockchain_research"}, {...job,onchain:{...job.onchain!,chainId:1}},
 ]){
   await assert.rejects(()=>executeWalletVerification({boardJobId:ID,internId:"3536"},{
     ...deps,getJob:async()=>bad
   }));
 }
});
test("LAURA refuses unverified RPC evidence",async()=>{
 for(const bad of [
  {...evidence,escrowStatus:1},
  {...evidence,escrowClient:STAGING.owner},
  {...evidence,escrowWorkerTba:BUYER},
  {...evidence,wallet:{...evidence.wallet,chainId:1}},
 ])await assert.rejects(()=>executeWalletVerification({boardJobId:ID,internId:"3536"},{
   ...deps,getEvidence:async()=>bad
 }),/UNTRUSTWORTHY_RPC_EVIDENCE/);
});
test("LAURA refuses two conflicting wallet targets",()=>{
 assert.throws(()=>assertJob({...job,description:BUYER+" "+STAGING.owner},"3536"),
   /AMBIGUOUS_WALLET_TARGET/);
});

test("LAURA checks complete job instructions against onchain hash and selects explicit target",()=>{
  const instruction="Verify wallet 0x30b2fe82f904910065eeecb71bb3665937fb1de7";
  const hash="0x"+createHash("sha256").update(instruction).digest("hex");
  const details={...job,requirementsText:instruction,requirementsHash:hash};
  const target=assertJob(details,"3536");
  assert.equal(target.source,"job_description");
  assert.equal(target.address.toLowerCase(),BUYER.toLowerCase());
  assert.throws(()=>assertJob({...details,requirementsText:instruction+" forged"},"3536"),
    /INSTRUCTIONS_HASH_MISMATCH/);
});
