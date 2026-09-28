import type { NextRequest } from "next/server";
import { z } from "zod";
import { visitorCompany } from "@/lib/company";
import { formErrors } from "@/server/form-errors";
import { allow, clientIp } from "@/server/rate-limit";
import { getRunController, isRunError, type RunError } from "@/server/runs";
import { publicRun } from "@/server/views";

export const dynamic = "force-dynamic";

const STATUS: Record<RunError["code"], number> = { not_found: 404, locked: 423, not_held: 409, busy: 409, not_eligible: 409, mismatch: 400 };

const Manual = z.object({
  verified_by: z.string().trim().min(2).max(60).regex(/^[\p{L}\p{N} .,&'()-]+$/u, "can only use letters, numbers, spaces, and . , & ' ( ) -"),
  method: z.enum(["in_person", "video_call", "known_number"]),
  confirm_last4: z.string().regex(/^\d{4}$/, "must be 4 digits"),
  note: z.string().trim().max(300).optional(),
});

/** Records a verification done outside Kovrell's call, for requests Kovrell can't call or whose call had no verdict. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/requests/[id]/manual">) {
  const limit = allow(`manual:${clientIp(req)}`, 10, 60_000);
  if (!limit.ok) {
    return Response.json({ error: `Too many tries. Try again in ${limit.retryAfterS} seconds.` }, { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } });
  }
  const parsed = Manual.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json(formErrors(parsed.error), { status: 400 });
  const { id } = await ctx.params;
  try {
    const run = await getRunController().recordManualVerification(id, parsed.data, await visitorCompany());
    return Response.json({ run: publicRun(run) }, { status: 201 });
  } catch (err) {
    if (isRunError(err)) return Response.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
    throw err;
  }
}
