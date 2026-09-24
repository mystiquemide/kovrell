import type { NextRequest } from "next/server";
import { getStore } from "@/server/store";
import { requestView } from "@/server/views";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/requests/[id]">) {
  const { id } = await ctx.params;
  const view = requestView(getStore(), id);
  if (!view) return Response.json({ error: "Request not found." }, { status: 404 });
  return Response.json(view);
}
