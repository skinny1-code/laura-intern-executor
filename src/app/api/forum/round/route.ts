import { NextResponse } from "next/server";
import { isViewerMode, viewerForbidden } from "@/lib/viewer/mode";
import { isForumRoundRunning, runForumRound } from "@/lib/swarm/forum";

export const dynamic = "force-dynamic";
/* Vercel Hobby requires a 1-300s limit. The viewer deployment blocks
   POST via isViewerMode(); full-length rounds run only in the private daemon. */
export const maxDuration = 300;

export async function POST() {
  if (isViewerMode()) return viewerForbidden();
  if (isForumRoundRunning()) {
    return NextResponse.json({ error: "A forum round is already running" }, { status: 409 });
  }
  const result = await runForumRound();
  return NextResponse.json(result);
}
