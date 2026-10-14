import {timingSafeEqual} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store","x-content-type-options":"nosniff"};

function authorized(req:NextRequest):boolean{
 const token=process.env.LAURA_INTERN_WORK_TOKEN||"";
 if(token.length<32)return false;
 const given=req.headers.get("authorization")||"";
 const expected="Bearer "+token;
 const a=Buffer.from(given),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
/**
 * Private LAURA work endpoint (not MCP). Read-only chain/report computation.
 * No transaction signing, escrow withdrawal, payout, verifier approval, CORS,
 * arbitrary RPC override, or sandbox/mock reports are allowed.
 */
export async function POST(req:NextRequest){
 console.info("[laura-intern-work] REQUEST_HANDLER_ENTERED");
 if(process.env.VIEWER_MODE==="1" || process.env.NEXT_PUBLIC_VIEWER_MODE==="1")
   return NextResponse.json({error:"LAURA_PUBLIC_VIEWER_CANNOT_EXECUTE_WORK"},{status:403,headers});
 if(process.env.LAURA_INTERN_WORK_ENABLED!=="true"||!process.env.LAURA_INTERN_WORK_TOKEN)
   return NextResponse.json({error:"LAURA_INTERN_EXECUTION_DISABLED"},{status:503,headers});
 if(!authorized(req))return NextResponse.json({error:"UNAUTHORIZED"},{status:401,headers});
 let executor:typeof import("@/lib/intern-work/execute")|undefined;
 try{
   const raw=await req.text();
   if(Buffer.byteLength(raw)>2048)return NextResponse.json({error:"REQUEST_TOO_LARGE"},{status:413,headers});
   const input:unknown=JSON.parse(raw);
   if(!input||typeof input!=="object"||Array.isArray(input))
     return NextResponse.json({error:"INVALID_INPUT"},{status:400,headers});
   const data=input as Record<string,unknown>;
   if(typeof data.boardJobId!=="string"||typeof data.internId!=="string")
     return NextResponse.json({error:"INVALID_INPUT"},{status:400,headers});
   // Load inside the guarded request, so a failed module initialization is
   // visible as a typed response and an actionable server log, never a silent 502.
   console.info("[laura-intern-work] REQUEST_AUTHORIZED_LOADING_EXECUTOR");
   executor=await import("@/lib/intern-work/execute");
   const result=await executor.executeInternWork({boardJobId:data.boardJobId,internId:data.internId});
   return NextResponse.json(result,{status:200,headers});
 }catch(error){
   if(executor&&error instanceof executor.WorkExecutionError){
     console.warn("[laura-intern-work] WORK_REJECTED",error.code);
     return NextResponse.json({error:error.code},{status:422,headers});
   }
   if(error instanceof SyntaxError)
     return NextResponse.json({error:"INVALID_JSON"},{status:400,headers});
   const code=error instanceof Error?error.message:"UNKNOWN_ERROR";
   console.error("[laura-intern-work] unable to verify/report job:",
     error instanceof Error?error.name:"unknown",code.slice(0,160));
   return NextResponse.json({error:"LAURA_WORK_EXECUTION_UNAVAILABLE"},{status:503,headers});
 }
}
