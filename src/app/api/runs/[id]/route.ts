import type { NextRequest } from "next/server";
import { COPY } from "@/lib/messages";
import { getStore } from "@/server/store";
import { runView } from "@/server/views";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  const view = runView(getStore(), id);
  if (!view) return Response.json({ error: COPY.runNotFound }, { status: 404 });
  // The tester sheet holds the answers. It renders only on the demo call screen, never over the API.
  return Response.json({ ...view, testerSheet: undefined });
}
