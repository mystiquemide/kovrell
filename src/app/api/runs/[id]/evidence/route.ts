import type { NextRequest } from "next/server";
import { COPY } from "@/lib/messages";
import { getStore } from "@/server/store";
import { evidenceView } from "@/server/views";

export const dynamic = "force-dynamic";

/** The sealed evidence pack. `?download=1` returns the canonical record as a file. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/runs/[id]/evidence">) {
  const { id } = await ctx.params;
  const view = evidenceView(getStore(), id);
  if (!view) return Response.json({ error: COPY.runNotFound }, { status: 404 });
  if (req.nextUrl.searchParams.get("download") === "1") {
    if (!view.record) return Response.json({ error: COPY.sealing }, { status: 409 });
    return new Response(JSON.stringify({ sha256: view.evidence?.sha256, record: view.record }, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="kovrell-${id}.json"`,
      },
    });
  }
  return Response.json(view);
}
