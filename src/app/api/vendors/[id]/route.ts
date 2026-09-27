import type { NextRequest } from "next/server";
import { COPY } from "@/lib/messages";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/vendors/[id]">) {
  const { id } = await ctx.params;
  const vendor = getStore().getVendor(id);
  if (!vendor) return Response.json({ error: COPY.vendorNotFound }, { status: 404 });
  return Response.json(vendor);
}
