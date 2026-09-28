import type { z } from "zod";

const FIELDS: Record<string, string> = {
  name: "Vendor name",
  payer_name: "Your company",
  contact_name: "Contact of record",
  contact_phone: "Phone of record",
  contact_email: "Email of record",
  bank_name: "Bank on file",
  account_last4: "Account ending",
  number_on_file_days: "Phone on file since",
  payment_amount_cents: "Payment to hold",
  new_bank_name: "New bank",
  new_account_last4: "New account ending",
  callback_contact: "Callback contact",
  webhook_url: "Webhook URL",
  vendor_id: "Vendor",
  channel: "Received by",
  invoices: "Invoices",
};
const INVOICE_FIELDS: Record<string, string> = { number: "number", amount_cents: "total", paid_on: "paid date" };

function fieldName(path: PropertyKey[]): string {
  if (path[0] === "invoices" && typeof path[1] === "number") {
    const part = INVOICE_FIELDS[String(path[2])];
    return `Invoice ${path[1] + 1}${part ? ` ${part}` : ""}`;
  }
  return FIELDS[String(path[0])] ?? "This field";
}

/** One plain sentence per problem, naming the field the way the form labels it. */
export function formErrors(error: z.ZodError): { error: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (fields[key]) continue;
    const name = fieldName(issue.path);
    const i = issue as z.core.$ZodIssue & { minimum?: number | bigint; origin?: string; input?: unknown };
    let text: string;
    if (i.code === "invalid_type") text = `${name} is missing.`;
    else if (i.code === "too_small" && i.origin === "string") text = `${name} needs at least ${i.minimum} characters.`;
    else if (i.code === "too_small" && i.origin === "array") text = `Add at least ${i.minimum} paid invoices.`;
    else if (i.code === "too_big" && i.origin === "array") text = "Use at most 6 invoices.";
    else if ((i.code === "too_small" || i.code === "too_big") && /amount|payment/.test(key)) text = `${name} must be between $1 and $10,000,000.`;
    else if (i.code === "too_big") text = `${name} is too long.`;
    else if (/^[a-z]/.test(i.message)) text = `${name} ${i.message}.`;
    else if (i.code === "custom") text = i.message;
    else text = `${name} isn't valid.`;
    fields[key] = text;
  }
  return { error: Object.values(fields)[0] ?? "Some details need fixing.", fields };
}
