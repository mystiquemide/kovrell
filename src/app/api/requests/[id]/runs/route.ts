import type { NextRequest } from "next/server";
import { visitorCompany } from "@/lib/company";
import { allow, clientIp } from "@/server/rate-limit";
import { getRunController, isRunError, type RunError } from "@/server/runs";
import { publicRun } from "@/server/views";

export const dynamic = "force-dynamic";

const STATUS: Record<RunError["code"], number> = { not_found: 404, locked: 423, not_held: 409, busy: 409 };

/** Each call link can open a paid voice session, so public callers get 3 runs a minute. */
const RUNS_PER_MINUTE = 3;

/** Starts a verification run and returns the single-use call link for the contact of record. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/requests/[id]/runs">) {
  const { id } = await ctx.params;
  const limit = allow(`runs:${clientIp(req)}`, RUNS_PER_MINUTE, 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: `Too many calls started. Try again in ${limit.retryAfterS} seconds.`, code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } },
    );
  }
  try {
    const { run, callUrl } = getRunController().createRun(id, await visitorCompany());
    return Response.json({ run: publicRun(run), callUrl }, { status: 201 });
  } catch (err) {
    if (isRunError(err)) return Response.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
    throw err;
  }
}
