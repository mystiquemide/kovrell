import type { NextRequest } from "next/server";
import { recordingUrl } from "@/server/evidence";
import { getRunController } from "@/server/runs";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

/** Redirects to a fresh signed recording URL from AssemblyAI. The API key stays on the server. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/runs/[id]/audio">) {
  const { id } = await ctx.params;
  const run = getStore().getRun(id);
  const fetcher = getRunController().sessionFetcher;
  if (!run?.aai_session_id || !fetcher) return Response.json({ error: "No recording for this run." }, { status: 404 });
  const url = await recordingUrl(fetcher, run.aai_session_id);
  if (!url) return Response.json({ error: "Recording is not ready yet." }, { status: 409 });
  return Response.redirect(url, 302);
}
