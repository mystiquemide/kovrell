import { timingSafeEqual } from "node:crypto";
import { getRunController } from "@/server/runs";

export const dynamic = "force-dynamic";

/** Anyone may reset the sample ledger so visitors can try a run, at most once a minute. */
const PUBLIC_RESET_INTERVAL_MS = 60_000;
const g = globalThis as unknown as { __kovrellLastReset?: number };

function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const given = req.headers.get("x-admin-token");
  if (!expected || !given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Restores the sample ledger. Refused while a call is live. */
export async function POST(req: Request) {
  if (getRunController().hasLiveCalls()) {
    return Response.json({ error: "A verification call is in progress. Try again when it ends." }, { status: 409 });
  }
  const now = Date.now();
  const last = g.__kovrellLastReset ?? 0;
  if (!isAdmin(req) && now - last < PUBLIC_RESET_INTERVAL_MS) {
    const wait = Math.ceil((PUBLIC_RESET_INTERVAL_MS - (now - last)) / 1000);
    return Response.json({ error: `The ledger was just reset. Try again in ${wait} seconds.` }, { status: 429 });
  }
  g.__kovrellLastReset = now;
  // Recordings go with the runs: the AssemblyAI sessions of every removed run are deleted too.
  const recordingsDeleted = await getRunController().resetLedger();
  return Response.json({ ok: true, recordingsDeleted });
}
