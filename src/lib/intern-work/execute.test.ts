import test from "node:test";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {executeWalletVerification,executeInternWork,assertServiceEvidence,INTERN_WORK_SERVICES,assertJob,getBoardJob,STAGING,type Job,type ChainEvidence} from "./execute";

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


test("LAURA only reads assigned customer requirements through the private bearer endpoint",async()=>{
 const prior=process.env.LAURA_INTERN_WORK_TOKEN;
 const secret="independent-private-laura-executor-test-token";
 process.env.LAURA_INTERN_WORK_TOKEN=secret;
 try{
   let requested=false;
   const stub=async(url:string,options?:RequestInit)=>{
     requested=true;
     assert.equal(url,STAGING.board+"/v1/laura/jobs/"+ID);
     assert.equal((options?.headers as Record<string,string>).authorization,"Bearer "+secret);
     return {ok:true,async json(){return {job:{...job,requirementsText:null}};}} as Response;
   };
   assert.equal((await getBoardJob(ID,stub as typeof fetch)).id,ID);
   assert.equal(requested,true);
 }finally{
   if(prior===undefined)delete process.env.LAURA_INTERN_WORK_TOKEN;
   else process.env.LAURA_INTERN_WORK_TOKEN=prior;
 }
});

test("work-only host denies every other route and never boots bots",async()=>{
 const {readFileSync}=await import("node:fs");
 const {fileURLToPath}=await import("node:url");
 const proxy=readFileSync(fileURLToPath(new URL("../../proxy.ts",import.meta.url)),"utf8");
 const instrumentation=readFileSync(fileURLToPath(new URL("../../instrumentation.ts",import.meta.url)),"utf8");
 assert.match(proxy,/LAURA_INTERN_WORK_ONLY/);
 assert.match(proxy,/path==="\/api\/intern-work\/execute"/);
 assert.match(proxy,/path==="\/api\/health"/);
 assert.match(proxy,/status:404/);
 assert.match(instrumentation,/LAURA_INTERN_WORK_ONLY === "true"/);
 assert.ok(instrumentation.indexOf('LAURA_INTERN_WORK_ONLY === "true"')<
   instrumentation.indexOf('const { startBots }'));
});

test("all canonical work services are registered without changing existing wallet execution",()=>{
 assert.equal(INTERN_WORK_SERVICES.length,13);
 assert.equal(new Set(INTERN_WORK_SERVICES).size,13);
 for(const serviceId of INTERN_WORK_SERVICES)
   assert.ok(INTERN_WORK_SERVICES.includes(serviceId));
 assert.equal(assertServiceEvidence(job),undefined);
});
test("non-wallet service refuses missing, forged, or unstructured acceptance evidence",()=>{
 const base={...job,serviceId:"ai_agent_evaluation"};
 assert.throws(()=>assertServiceEvidence(base),/SERVICE_EVIDENCE_REQUIRED/);
 assert.throws(()=>assertServiceEvidence({...base,requirementsText:"Testv4"}),/INSTRUCTIONS_HASH_MISMATCH/);
 const description=JSON.stringify({serviceId:"ai_agent_evaluation",observations:[{source:"client-case",value:"observed output"}]});
 const withHash={...base,requirementsText:description,requirementsHash:"0x"+createHash("sha256").update(description).digest("hex")};
 assert.throws(()=>assertServiceEvidence(withHash),/EVALUATION_ASSERTIONS_REQUIRED/);
 assert.throws(()=>assertServiceEvidence({...withHash,serviceId:"smart_contract_security_triage"}),/SERVICE_EVIDENCE_MISMATCH/);
});
test("bound catalog inference produces a review-only report, not a payment or verification claim",async()=>{
 const requirementsText=JSON.stringify({
   serviceId:"ai_agent_evaluation",observations:[{source:"case-1",value:"agent answer"}],
   assertions:[{kind:"required_text",value:"agent"}]
 });
 const details={...job,serviceId:"ai_agent_evaluation",requirementsText,
   requirementsHash:"0x"+createHash("sha256").update(requirementsText).digest("hex")};
 const ev={...evidence,escrowRequirementsHash:details.requirementsHash};
 const result=await executeInternWork({boardJobId:ID,internId:"3536"},{
   getJob:async()=>details,getEvidence:async()=>ev,
   summarize:async()=>({text,modelId:"gemini-flash-latest",usedMock:false})
 });
 const report=result.report as Record<string,unknown>;
 assert.equal(report.serviceId,"ai_agent_evaluation");
 assert.equal(report.verificationStatus,"PENDING_INDEPENDENT_VERIFIER");
 assert.equal((report.chainEvidence as ChainEvidence).escrowStatus,2);
 assert.match(result.resultHash,/^0x[0-9a-f]{64}$/);
 assert.equal(result.reportJson,JSON.stringify(result.report));
});
