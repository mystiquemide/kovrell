import { timingSafeEqual } from "node:crypto";
import { getRunController } from "@/server/runs";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const given = req.headers.get("x-admin-token");
  if (!expected || !given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Restores the sample ledger. Guarded by ADMIN_TOKEN. */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Not authorized." }, { status: 401 });
  if (getRunController().hasLiveCalls()) {
    return Response.json({ error: "A verification call is in progress. Try again when it ends." }, { status: 409 });
  }
  getStore().reset();
  return Response.json({ ok: true });
}
