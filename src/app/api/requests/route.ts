import { randomUUID } from "node:crypto";
import { z } from "zod";
import { COPY } from "@/lib/messages";
import { formErrors } from "@/server/form-errors";
import { getStore } from "@/server/store";
import { inboxView } from "@/server/views";
import { checkWebhookUrl, newWebhookSecret } from "@/server/webhook";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ requests: inboxView(getStore()) });
}

const CreateRequest = z.object({
  vendor_id: z.string().min(1),
  channel: z.enum(["email", "portal", "phone", "letter"]),
  new_bank_name: z.string().min(2).max(80),
  new_account_last4: z.string().regex(/^\d{4}$/, "must be 4 digits"),
  callback_contact: z.string().max(80).nullable().optional(),
  /** Where the verdict is posted when the call ends. Public https only. */
  webhook_url: z.string().trim().max(300).optional(),
});

/** Integration seam: an AP inbox or ERP posts bank-change requests here. */
export async function POST(req: Request) {
  const parsed = CreateRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json(formErrors(parsed.error), { status: 400 });
  const store = getStore();
  if (!store.getVendor(parsed.data.vendor_id)) return Response.json({ error: COPY.vendorNotFound }, { status: 404 });
  const { webhook_url, ...fields } = parsed.data;
  if (webhook_url) {
    const checked = await checkWebhookUrl(webhook_url);
    if (!checked.ok) return Response.json({ error: checked.reason }, { status: 400 });
  }
  try {
    const request = store.createRequest({
      id: `req_${randomUUID().slice(0, 8)}`,
      ...fields,
      callback_contact: fields.callback_contact ?? null,
      received_at: new Date().toISOString(),
    });
    if (!webhook_url) return Response.json({ request }, { status: 201 });
    // The secret is shown once, here. Use it to check the kovrell-signature header on each delivery.
    const secret = newWebhookSecret();
    store.setWebhook(request.id, webhook_url, secret);
    return Response.json({ request, webhook: { url: webhook_url, secret } }, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 409 });
  }
}
