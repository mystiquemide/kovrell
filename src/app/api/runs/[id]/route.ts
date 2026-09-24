import type { NextRequest } from "next/server";
import { getStore } from "@/server/store";
import { runView } from "@/server/views";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  const view = runView(getStore(), id);
  if (!view) return Response.json({ error: "Run not found." }, { status: 404 });
  return Response.json(view);
}
