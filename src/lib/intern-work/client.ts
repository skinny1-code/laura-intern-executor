import { z } from "zod";

const work = z.object({
  fingerprint:z.string().min(8),
  title:z.string(),
  requiredTier:z.coerce.number().int().min(0),
  expectedNet:z.coerce.number(),
  executionClass:z.literal("AGENT_EXECUTABLE"),
  executionSpec:z.object({
    serviceId:z.enum(["wallet_verification","token_nft_provenance","blockchain_research","contract_deployment_verification","ai_output_verification"]),
    instructions:z.string().min(1).max(4000),
    sourceTaskId:z.string().nullable().optional()
  })
});

function base(){return (process.env.INTERN_WORK_API_URL??"https://stonk-intern-work.onrender.com").replace(/\/$/,"");}
function token(){const v=process.env.INTERN_WORK_API_TOKEN;if(!v)throw new Error("INTERN_WORK_API_TOKEN_NOT_CONFIGURED");return v;}
async function call(path:string,init:RequestInit={}){
 const headers=new Headers(init.headers);headers.set("accept","application/json");headers.set("authorization",`Bearer ${token()}`);
 if(init.body)headers.set("content-type","application/json");
 const r=await fetch(base()+path,{...init,headers,redirect:"error",signal:AbortSignal.timeout(20_000)});
 const ct=r.headers.get("content-type")??"";if(!ct.includes("application/json"))throw new Error("INTERN_WORK_API_NOT_JSON");
 const j=await r.json() as any;if(!r.ok)throw new Error(String(j?.error??`INTERN_WORK_HTTP_${r.status}`));return j;
}
export async function discoverInternWork(){return call("/v1/opportunities/discover",{method:"POST",body:"{}"});}
export async function internWorkCandidates(){
 const j=await call("/v1/opportunities");const rows=Array.isArray(j.opportunities)?j.opportunities:[];
 return rows.filter((x:any)=>x?.routable===true&&x?.executionClass==="AGENT_EXECUTABLE"&&x?.executionSpec?.serviceId)
   .map((x:any)=>work.parse(x)).sort((a,b)=>b.expectedNet-a.expectedNet||a.fingerprint.localeCompare(b.fingerprint));
}
export async function getInternWorkOpportunity(opportunityId:string){
 const j=await call("/v1/opportunities");
 const rows=Array.isArray(j.opportunities)?j.opportunities:[];
 const hit=rows.find((x:any)=>x?.fingerprint===opportunityId);
 return hit?work.parse(hit):null;
}
export async function routeIntern(opportunityId:string,internIds:string[]){
 const interns=internIds.map(internId=>({internId}));
 return call("/v1/qualifications/route",{method:"POST",body:JSON.stringify({opportunityId,interns})});
}
export async function prepareAssignment(input:{opportunityId:string;jobId:string;internId:string;client:string}){
 return call("/v1/jobs/prepare-assignment",{method:"POST",body:JSON.stringify(input)});
}
export async function prepareResult(input:{jobId:string;resultHash:string;workerTba:string}){
 return call("/v1/jobs/prepare-result",{method:"POST",body:JSON.stringify(input)});
}
