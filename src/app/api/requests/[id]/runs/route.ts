import type { NextRequest } from "next/server";
import { getRunController, isRunError, type RunError } from "@/server/runs";
import { publicRun } from "@/server/views";

export const dynamic = "force-dynamic";

const STATUS: Record<RunError["code"], number> = { not_found: 404, locked: 423, not_held: 409, busy: 409 };

/** Starts a verification run and returns the single-use call link for the contact of record. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/requests/[id]/runs">) {
  const { id } = await ctx.params;
  try {
    const { run, callUrl } = getRunController().createRun(id);
    return Response.json({ run: publicRun(run), callUrl }, { status: 201 });
  } catch (err) {
    if (isRunError(err)) return Response.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
    throw err;
  }
}
