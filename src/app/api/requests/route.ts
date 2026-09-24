import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getStore } from "@/server/store";
import { inboxView } from "@/server/views";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ requests: inboxView(getStore()) });
}

const CreateRequest = z.object({
  vendor_id: z.string().min(1),
  channel: z.enum(["email", "portal", "phone", "letter"]),
  new_bank_name: z.string().min(2).max(80),
  new_account_last4: z.string().regex(/^\d{4}$/, "Four digits"),
  callback_contact: z.string().max(80).nullable().optional(),
});

/** Integration seam: an AP inbox or ERP posts bank-change requests here. */
export async function POST(req: Request) {
  const parsed = CreateRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const store = getStore();
  if (!store.getVendor(parsed.data.vendor_id)) return Response.json({ error: "Unknown vendor." }, { status: 404 });
  try {
    const request = store.createRequest({
      id: `req_${randomUUID().slice(0, 8)}`,
      ...parsed.data,
      callback_contact: parsed.data.callback_contact ?? null,
      received_at: new Date().toISOString(),
    });
    return Response.json({ request }, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 409 });
  }
}
