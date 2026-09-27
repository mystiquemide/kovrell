import Link from "next/link";
import { Arrow, ButtonLink } from "@/components/button";
import { dateOnly } from "@/lib/format";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendors" };

export default function VendorsPage() {
  const vendors = getStore().listVendors();
  return (
    <div className="reveal">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-subtle">Vendor master</p>
          <h1 className="heading mt-3 text-[32px] sm:text-[40px]">Contacts of record</h1>
          <p className="mt-3 max-w-2xl text-muted">Kovrell only ever calls these contacts. Changes to them are logged and lock calls for 30 days.</p>
        </div>
        <ButtonLink href="/setup">
          Add a vendor <Arrow />
        </ButtonLink>
      </div>

      {vendors.length === 0 ? (
        <p className="mt-16 text-muted">No vendors in the ledger.</p>
      ) : (
        <div className="mt-12 overflow-x-auto">
          <table className="w-full sm:min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="label text-subtle">
                <th className="pb-3 font-medium">Vendor</th>
                <th className="pb-3 font-medium">Contact of record</th>
                <th className="hidden pb-3 font-medium sm:table-cell">Bank on file</th>
                <th className="hidden pb-3 font-medium md:table-cell">Last change</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="relative border-t border-line hover:bg-panel">
                  <td className="py-4 pr-4">
                    <Link href={`/vendors/${v.id}`} className="after:absolute after:inset-0">
                      {v.name}
                    </Link>
                    {v.held_request_id && <p className="label mt-1 text-fail">Bank change held</p>}
                  </td>
                  <td className="py-4 pr-4">
                    <p>{v.contact_name}</p>
                    <p className="data text-[14px] text-muted">{v.contact_phone}</p>
                  </td>
                  <td className="hidden py-4 pr-4 text-muted sm:table-cell">
                    {v.bank_name} <span className="data text-ink">{v.account_last4}</span>
                  </td>
                  <td className="data hidden py-4 text-[14px] text-muted md:table-cell">{v.last_change_at ? dateOnly(v.last_change_at) : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
