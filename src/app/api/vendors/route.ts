import { z } from "zod";
import { allow, clientIp } from "@/server/rate-limit";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ vendors: getStore().listVendors() });
}

// Names and invoice numbers go into the agent's prompt and keyterms, so they stay short and plain.
const name = z.string().trim().min(2).max(60).regex(/^[\p{L}\p{N} .,&'()-]+$/u, "Letters, numbers, spaces and . , & ' ( ) - only");
const last4 = z.string().regex(/^\d{4}$/, "Four digits");
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

const CreateVendor = z
  .object({
    name,
    payer_name: name.optional(),
    contact_name: name,
    contact_phone: z.string().trim().min(7).max(24).regex(/^[+\d ()-]+$/, "Phone digits only"),
    contact_email: z.string().trim().max(80).optional().default(""),
    bank_name: name,
    account_last4: last4,
    number_on_file_days: z.number().int().min(0).max(3650),
    invoices: z
      .array(
        z.object({
          number: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9-]+$/, "Letters, digits and dashes"),
          amount_cents: z.number().int().min(100).max(1_000_000_000),
          paid_on: isoDay,
        }),
      )
      .min(2)
      .max(6),
    payment_amount_cents: z.number().int().min(100).max(1_000_000_000),
  })
  .superRefine((v, ctx) => {
    const numbers = v.invoices.map((i) => i.number.toUpperCase());
    if (new Set(numbers).size !== numbers.length) ctx.addIssue({ code: "custom", message: "Invoice numbers must be unique", path: ["invoices"] });
    const today = new Date().toISOString().slice(0, 10);
    const oldest = new Date(Date.now() - 3 * 365 * 86_400_000).toISOString().slice(0, 10);
    v.invoices.forEach((inv, i) => {
      if (Number.isNaN(Date.parse(inv.paid_on)) || inv.paid_on > today || inv.paid_on < oldest) {
        ctx.addIssue({ code: "custom", message: "Paid date must be a real date within the last 3 years", path: ["invoices", i, "paid_on"] });
      }
    });
  });

/** Integration seam: the ERP syncs a vendor, its contact of record, and its paid invoices here. */
export async function POST(req: Request) {
  const limit = allow(`vendors:${clientIp(req)}`, 3, 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: `Too many vendors added. Try again in ${limit.retryAfterS} seconds.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } },
    );
  }
  const parsed = CreateVendor.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const vendor = getStore().createVendorLedger(parsed.data);
  return Response.json({ vendor }, { status: 201 });
}
