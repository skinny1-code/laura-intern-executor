import {NextResponse,type NextRequest} from "next/server";

/**
 * Dedicated LAURA Intern execution deployment has exactly two surface routes.
 * All other API/UI/bot/cron/snapshot/admin paths are denied at the request edge.
 * This guard is inactive on the original LAURA host unless expressly enabled.
 */
export function proxy(request:NextRequest){
  if(process.env.LAURA_INTERN_WORK_ONLY!=="true")return NextResponse.next();
  const path=request.nextUrl.pathname,method=request.method.toUpperCase();
  if((path==="/api/intern-work/execute"&&method==="POST")||
     (path==="/api/health"&&method==="GET"))
    return NextResponse.next();
  return new NextResponse(null,{status:404,headers:{
    "cache-control":"no-store","x-content-type-options":"nosniff",
    "x-robots-tag":"noindex, nofollow"
  }});
}
export const config={matcher:"/:path*"};
