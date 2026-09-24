import Link from "next/link";
import { notFound } from "next/navigation";
import { dateOnly } from "@/lib/format";
import { getStore } from "@/server/store";
import { vendorView } from "@/server/views";
import { PROVENANCE_WINDOW_DAYS } from "@/server/verification/provenance";

export const dynamic = "force-dynamic";

const FIELD: Record<string, string> = {
  contact_phone: "Phone of record",
  contact_email: "Email of record",
  account_last4: "Bank account",
};

export default async function VendorPage({ params }: PageProps<"/vendors/[id]">) {
  const { id } = await params;
  const data = vendorView(getStore(), id);
  if (!data) notFound();
  const { vendor, changes } = data;

  return (
    <div className="reveal">
      <Link href="/vendors" className="label text-zinc hover:text-cream">
        &larr; Vendors
      </Link>
      <h1 className="heading mt-6 text-[32px] sm:text-[40px]">{vendor.name}</h1>

      <section className="mt-10 grid gap-px overflow-hidden rounded-[5.6px] border border-iron bg-iron sm:grid-cols-2">
        <div className="bg-carbon p-6">
          <p className="label text-zinc">Contact of record</p>
          <p className="mt-3 text-[18px]">{vendor.contact_name}</p>
          <p className="data mt-1 text-mercury">{vendor.contact_phone}</p>
          <p className="data text-[14px] text-mercury">{vendor.contact_email}</p>
        </div>
        <div className="bg-carbon p-6">
          <p className="label text-zinc">Bank on file</p>
          <p className="mt-3 text-[18px]">{vendor.bank_name}</p>
          <p className="mt-1 text-mercury">
            Account ending <span className="data text-cream">{vendor.account_last4}</span>
          </p>
        </div>
      </section>

      <section className="mt-12">
        <p className="label text-zinc">Change log</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="label text-zinc">
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
                  <tr key={c.id} className="border-t border-iron">
                    <td className="py-3 pr-4">{FIELD[c.field] ?? c.field}</td>
                    <td className="data py-3 pr-4 text-[14px] text-mercury">{c.old_value ?? "New"}</td>
                    <td className="data py-3 pr-4 text-[14px]">{c.new_value}</td>
                    <td className="data py-3 pr-4 text-[14px] text-mercury">
                      {dateOnly(c.changed_at)}
                      {c.recent && <span className="label ml-3 text-ember">Within {PROVENANCE_WINDOW_DAYS} days</span>}
                    </td>
                    <td className="py-3 text-[14px] text-mercury">{c.source}</td>
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
