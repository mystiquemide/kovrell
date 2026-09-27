"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Arrow, PRIMARY, SECONDARY } from "@/components/button";

type InvoiceRow = { number: string; amount: string; paid_on: string };

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

const FIELD = "mt-1.5 h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-[15px] text-ink outline-none focus:border-line-strong";
const LABEL = "block text-[14px] text-muted";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className={LABEL}>
      {label}
      {children}
      {hint && <span className="mt-1 block text-[13px] text-subtle">{hint}</span>}
    </label>
  );
}

function toCents(v: string): number {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function SetupForm() {
  const router = useRouter();
  const [vendor, setVendor] = useState({
    payer_name: "",
    name: "Pine Ridge Lumber",
    contact_name: "Alex Morgan",
    contact_phone: "+1 503 555 0164",
    bank_name: "U.S. Bank",
    account_last4: "3907",
    number_on_file_days: 540,
  });
  const [invoices, setInvoices] = useState<InvoiceRow[]>([
    { number: "PRL-1182", amount: "18,240.00", paid_on: daysAgo(64) },
    { number: "PRL-1207", amount: "22,915.50", paid_on: daysAgo(35) },
    { number: "PRL-1231", amount: "9,780.00", paid_on: daysAgo(11) },
  ]);
  const [change, setChange] = useState({ new_bank_name: "Bank of America", new_account_last4: "6612", payment: "31,400.00", channel: "email", webhook_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setInvoice = (i: number, patch: Partial<InvoiceRow>) => setInvoices((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const post = (url: string, body: unknown) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
        .catch(() => ({ ok: false, body: { error: "Could not reach Kovrell. Nothing was saved." } }));

    const { payer_name, ...rest } = vendor;
    const added = await post("/api/vendors", {
      ...rest,
      ...(payer_name.trim() ? { payer_name: payer_name.trim() } : {}),
      invoices: invoices.map((r) => ({ number: r.number, amount_cents: toCents(r.amount), paid_on: r.paid_on })),
      payment_amount_cents: toCents(change.payment),
    });
    if (!added.ok) {
      setError(added.body.error ?? "Could not add the vendor.");
      setBusy(false);
      return;
    }
    const request = await post("/api/requests", {
      vendor_id: added.body.vendor.id,
      channel: change.channel,
      new_bank_name: change.new_bank_name,
      new_account_last4: change.new_account_last4,
      ...(change.webhook_url.trim() ? { webhook_url: change.webhook_url.trim() } : {}),
    });
    if (!request.ok) {
      setError(request.body.error ?? "Could not create the change request.");
      setBusy(false);
      return;
    }
    router.push(`/requests/${request.body.request.id}`);
  }

  return (
    <form onSubmit={submit} className="mt-10 border-t border-line">
      <section className="grid gap-4 border-b border-line py-8 sm:grid-cols-[64px_1fr]">
        <span className="data text-[14px] text-subtle">01</span>
        <div className="min-w-0">
          <h2 className="subheading text-[20px] text-ink">Vendor of record</h2>
          <p className="mt-2 text-[15px] leading-[1.55] text-muted">What your vendor master already holds. Kovrell only ever calls this contact.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Your company" hint="Who the agent calls on behalf of. Leave blank to call as Acme Manufacturing.">
                <input
                  className={FIELD}
                  placeholder="Acme Manufacturing"
                  value={vendor.payer_name}
                  onChange={(e) => setVendor({ ...vendor, payer_name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Vendor">
              <input className={FIELD} value={vendor.name} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} required />
            </Field>
            <Field label="Contact of record" hint="The agent asks for this person by name.">
              <input className={FIELD} value={vendor.contact_name} onChange={(e) => setVendor({ ...vendor, contact_name: e.target.value })} required />
            </Field>
            <Field label="Phone of record" hint="Shown on the evidence. Demo calls ring through the browser.">
              <input className={FIELD} value={vendor.contact_phone} onChange={(e) => setVendor({ ...vendor, contact_phone: e.target.value })} required />
            </Field>
            <Field label="Phone on file since">
              <select
                className={FIELD}
                value={vendor.number_on_file_days}
                onChange={(e) => setVendor({ ...vendor, number_on_file_days: Number(e.target.value) })}
              >
                <option value={540}>Over a year</option>
                <option value={120}>About four months</option>
                <option value={6}>Changed 6 days ago (Kovrell will refuse to call)</option>
              </select>
            </Field>
            <Field label="Bank on file">
              <input className={FIELD} value={vendor.bank_name} onChange={(e) => setVendor({ ...vendor, bank_name: e.target.value })} required />
            </Field>
            <Field label="Account ending">
              <input
                className={`${FIELD} data`}
                inputMode="numeric"
                maxLength={4}
                value={vendor.account_last4}
                onChange={(e) => setVendor({ ...vendor, account_last4: e.target.value.replace(/\D/g, "") })}
                required
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-b border-line py-8 sm:grid-cols-[64px_1fr]">
        <span className="data text-[14px] text-subtle">02</span>
        <div className="min-w-0">
          <h2 className="subheading text-[20px] text-ink">Paid invoices</h2>
          <p className="mt-2 text-[15px] leading-[1.55] text-muted">
            From your AP ledger. Each call asks for two of these totals and one payment date, picked at random. The agent never sees the answers.
          </p>
          <div className="mt-6 space-y-3">
            {invoices.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr] gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <Field label={i === 0 ? "Invoice" : ""}>
                  <input className={`${FIELD} data`} aria-label="Invoice number" value={r.number} onChange={(e) => setInvoice(i, { number: e.target.value })} required />
                </Field>
                <Field label={i === 0 ? "Total ($)" : ""}>
                  <input className={`${FIELD} data`} aria-label="Invoice total" inputMode="decimal" value={r.amount} onChange={(e) => setInvoice(i, { amount: e.target.value })} required />
                </Field>
                <Field label={i === 0 ? "Paid on" : ""}>
                  <input className={`${FIELD} data`} aria-label="Paid on" type="date" value={r.paid_on} onChange={(e) => setInvoice(i, { paid_on: e.target.value })} required />
                </Field>
                <button
                  type="button"
                  onClick={() => setInvoices((rows) => rows.filter((_, j) => j !== i))}
                  disabled={invoices.length <= 2}
                  className={`${SECONDARY} sm:mb-0`}
                  aria-label={`Remove invoice ${r.number}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setInvoices((rows) => [...rows, { number: "", amount: "", paid_on: daysAgo(90) }])}
            disabled={invoices.length >= 6}
            className={`${SECONDARY} mt-4`}
          >
            Add invoice
          </button>
        </div>
      </section>

      <section className="grid gap-4 border-b border-line py-8 sm:grid-cols-[64px_1fr]">
        <span className="data text-[14px] text-subtle">03</span>
        <div className="min-w-0">
          <h2 className="subheading text-[20px] text-ink">The bank-change request</h2>
          <p className="mt-2 text-[15px] leading-[1.55] text-muted">The request that just arrived. Kovrell holds the next payment until the call decides it.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="New bank">
              <input className={FIELD} value={change.new_bank_name} onChange={(e) => setChange({ ...change, new_bank_name: e.target.value })} required />
            </Field>
            <Field label="New account ending">
              <input
                className={`${FIELD} data`}
                inputMode="numeric"
                maxLength={4}
                value={change.new_account_last4}
                onChange={(e) => setChange({ ...change, new_account_last4: e.target.value.replace(/\D/g, "") })}
                required
              />
            </Field>
            <Field label="Payment to hold ($)">
              <input className={`${FIELD} data`} inputMode="decimal" value={change.payment} onChange={(e) => setChange({ ...change, payment: e.target.value })} required />
            </Field>
            <Field label="Received by">
              <select className={FIELD} value={change.channel} onChange={(e) => setChange({ ...change, channel: e.target.value })}>
                <option value="email">Email</option>
                <option value="portal">Vendor portal</option>
                <option value="phone">Phone</option>
                <option value="letter">Letter</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Webhook URL (optional)" hint="Where your ERP hears the verdict. Paste a webhook.site URL to watch Kovrell post it, signed, when the call ends.">
                <input
                  className={FIELD}
                  type="url"
                  placeholder="https://webhook.site/..."
                  value={change.webhook_url}
                  onChange={(e) => setChange({ ...change, webhook_url: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-8">
        <button type="submit" disabled={busy} className={PRIMARY}>
          {busy ? "Adding" : "Add vendor and hold payment"} {!busy && <Arrow />}
        </button>
        <p className={`text-[14px] ${error ? "text-fail" : "text-muted"}`}>{error ?? "Next you'll call the vendor and play them yourself."}</p>
      </div>
    </form>
  );
}
