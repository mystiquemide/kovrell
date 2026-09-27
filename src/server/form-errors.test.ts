import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formErrors } from "./form-errors";

const schema = z.object({
  name: z.string().min(2).regex(/^[a-z ]+$/i, "can only use letters and spaces"),
  account_last4: z.string().regex(/^\d{4}$/, "must be 4 digits"),
  invoices: z.array(z.object({ amount_cents: z.number().int().min(100) })).min(2),
  payment_amount_cents: z.number().min(100),
});

describe("formErrors", () => {
  it("names each field the way the form labels it, in plain sentences", () => {
    const r = schema.safeParse({ name: "x", account_last4: "12a", invoices: [{ amount_cents: 5 }], payment_amount_cents: null });
    expect(r.success).toBe(false);
    const { error, fields } = formErrors(r.error!);
    expect(fields.name).toBe("Vendor name needs at least 2 characters.");
    expect(fields.account_last4).toBe("Account ending must be 4 digits.");
    expect(fields["invoices.0.amount_cents"]).toBe("Invoice 1 total must be between $1 and $10,000,000.");
    expect(fields.invoices).toBe("Add at least 2 paid invoices.");
    expect(fields.payment_amount_cents).toBe("Payment to hold is missing.");
    expect(error).toBe(fields.name);
    for (const t of Object.values(fields)) expect(t).not.toMatch(/✖|→|expected|>=/);
  });
});
