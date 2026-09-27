import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Stamp, verdictStamp } from "@/components/stamp";
import { dateOnly, dateTime, money } from "@/lib/format";
import { getStore } from "@/server/store";
import { vendorView } from "@/server/views";
import { PROVENANCE_WINDOW_DAYS } from "@/server/verification/provenance";

export const dynamic = "force-dynamic";

const FIELD: Record<string, string> = {
  contact_phone: "Phone of record",
  contact_email: "Email of record",
  account_last4: "Bank account",
};

export async function generateMetadata({ params }: PageProps<"/vendors/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getStore().getVendor(id)?.vendor.name ?? "Vendor" };
}

export default async function VendorPage({ params }: PageProps<"/vendors/[id]">) {
  const { id } = await params;
  const data = vendorView(getStore(), id);
  if (!data) notFound();
  const { vendor, changes, questionPool, heldRequest, runs } = data;

  return (
    <div className="reveal">
      <Link href="/vendors" className="label text-subtle hover:text-ink">
        &larr; Vendors
      </Link>
      <h1 className="heading mt-6 text-[32px] sm:text-[40px]">{vendor.name}</h1>
      {vendor.payer_name && <p className="mt-2 text-muted">Calls on behalf of {vendor.payer_name}.</p>}

      {heldRequest && (
        <Link
          href={`/requests/${heldRequest.id}`}
          className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-panel px-5 py-4 hover:border-line-strong"
        >
          <span>
            Bank change held: <span className="data">{money(heldRequest.amount_cents)}</span> to {heldRequest.new_bank_name} ending{" "}
            <span className="data">{heldRequest.new_account_last4}</span>.
          </span>
          <span className="text-ink underline underline-offset-4">Open request &rarr;</span>
        </Link>
      )}

      <section className="mt-10 grid gap-px overflow-hidden rounded-[5.6px] border border-line bg-line sm:grid-cols-2">
        <div className="bg-panel p-6">
          <p className="label text-subtle">Contact of record</p>
          <p className="mt-3 text-[18px]">{vendor.contact_name}</p>
          <p className="data mt-1 text-muted">{vendor.contact_phone}</p>
          {vendor.contact_email && <p className="data text-[14px] text-muted">{vendor.contact_email}</p>}
        </div>
        <div className="bg-panel p-6">
          <p className="label text-subtle">Bank on file</p>
          <p className="mt-3 text-[18px]">{vendor.bank_name}</p>
          <p className="mt-1 text-muted">
            Account ending <span className="data text-ink">{vendor.account_last4}</span>
          </p>
        </div>
      </section>

      <section className="mt-12">
        <p className="label text-subtle">Question pool</p>
        {questionPool.length >= 2 ? (
          <>
            <p className="mt-3 text-muted">{questionPool.join(", ")}</p>
            <p className="mt-1 text-[14px] text-subtle">Each call asks two totals and one payment date from these invoices. The values stay in the ledger.</p>
          </>
        ) : (
          <p className="mt-3 text-muted">Kovrell can&apos;t call this vendor yet. It needs two paid invoices to ask about.</p>
        )}
      </section>

      <section className="mt-12">
        <p className="label text-subtle">Verification history</p>
        {runs.length === 0 ? (
          <p className="mt-3 text-muted">No verification calls yet.</p>
        ) : (
          <div className="mt-3 border-t border-line">
            {runs.map((r) => (
              <Link
                key={r.id}
                href={r.status === "ended" ? `/evidence/${r.id}` : `/calls/${r.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 border-b border-line py-3 hover:bg-panel sm:grid-cols-[140px_1fr_auto_auto]"
              >
                <span className="data text-[14px]">{r.id}</span>
                <span className="text-[14px] text-muted">{dateTime(r.started_at)}</span>
                <span className="data hidden text-[13px] text-subtle sm:inline">{r.sha256 ? `${r.sha256.slice(0, 8)}...${r.sha256.slice(-4)}` : "Not sealed"}</span>
                <Stamp kind={verdictStamp(r.verdict, r.status)} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <p className="label text-subtle">Change log</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="label text-subtle">
                <th className="pb-3 font-medium">Field</th>
                <th className="pb-3 font-medium">From</th>
                <th className="pb-3 font-medium">To</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => {
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-3 pr-4">{FIELD[c.field] ?? c.field}</td>
                    <td className="data py-3 pr-4 text-[14px] text-muted">{c.old_value ?? "New"}</td>
                    <td className="data py-3 pr-4 text-[14px]">{c.new_value}</td>
                    <td className="data py-3 pr-4 text-[14px] text-muted">
                      {dateOnly(c.changed_at)}
                      {c.recent && <span className="label ml-3 text-fail">Within {PROVENANCE_WINDOW_DAYS} days</span>}
                    </td>
                    <td className="py-3 text-[14px] text-muted">{c.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
