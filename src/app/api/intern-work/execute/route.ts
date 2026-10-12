import {timingSafeEqual} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {executeWalletVerification,WorkExecutionError} from "@/lib/intern-work/execute";

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
 if(process.env.LAURA_INTERN_WORK_ENABLED!=="true"||!process.env.LAURA_INTERN_WORK_TOKEN)
   return NextResponse.json({error:"LAURA_INTERN_EXECUTION_DISABLED"},{status:503,headers});
 if(!authorized(req))return NextResponse.json({error:"UNAUTHORIZED"},{status:401,headers});
 try{
   const raw=await req.text();
   if(Buffer.byteLength(raw)>2048)return NextResponse.json({error:"REQUEST_TOO_LARGE"},{status:413,headers});
   const input:unknown=JSON.parse(raw);
   if(!input||typeof input!=="object"||Array.isArray(input))
     return NextResponse.json({error:"INVALID_INPUT"},{status:400,headers});
   const data=input as Record<string,unknown>;
   if(typeof data.boardJobId!=="string"||typeof data.internId!=="string")
     return NextResponse.json({error:"INVALID_INPUT"},{status:400,headers});
   const result=await executeWalletVerification({boardJobId:data.boardJobId,internId:data.internId});
   return NextResponse.json(result,{status:200,headers});
 }catch(error){
   if(error instanceof WorkExecutionError)
     return NextResponse.json({error:error.code},{status:422,headers});
   if(error instanceof SyntaxError)
     return NextResponse.json({error:"INVALID_JSON"},{status:400,headers});
   console.error("[laura-intern-work] unable to verify/report job:",error instanceof Error?error.name:"unknown");
   return NextResponse.json({error:"LAURA_WORK_EXECUTION_UNAVAILABLE"},{status:503,headers});
 }
}
