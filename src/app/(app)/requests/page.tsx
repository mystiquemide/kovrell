import Link from "next/link";
import { Stamp, requestStamp } from "@/components/stamp";
import { CHANNEL_LABEL, dateTime, money } from "@/lib/format";
import { getStore } from "@/server/store";
import { inboxView } from "@/server/views";

export const dynamic = "force-dynamic";
export const metadata = { title: "Requests" };

export default function RequestsPage() {
  const rows = inboxView(getStore());
  const held = rows.filter((r) => r.status === "held" && !r.locked).length;
  const locked = rows.filter((r) => r.locked).length;
  const decided = rows.length - held - locked;

  return (
    <div className="reveal">
      <p className="label text-zinc">Bank-detail changes</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="heading text-[32px] sm:text-[40px]">Payments held for verification</h1>
        {rows.length > 0 && (
          <p className="label text-mercury">
            {held} held <span className="text-steel">/</span> {locked} locked <span className="text-steel">/</span> {decided} decided
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-16 max-w-md text-mercury">No bank-detail changes waiting. Payments release on schedule.</p>
      ) : (
        <div className="mt-12 overflow-x-auto">
          <table className="w-full sm:min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="label text-zinc">
                <th className="pb-3 font-medium">Vendor</th>
                <th className="hidden pb-3 font-medium sm:table-cell">Received</th>
                <th className="hidden pb-3 font-medium md:table-cell">Via</th>
                <th className="pb-3 text-right font-medium">Amount</th>
                <th className="pb-3 pl-4 font-medium sm:pl-8">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="group relative border-t border-iron hover:bg-carbon">
                  <td className="py-4 pr-4">
                    <Link href={`/requests/${r.id}`} className="text-[16px] after:absolute after:inset-0">
                      {r.vendor_name}
                    </Link>
                    <p className="mt-0.5 text-[14px] text-zinc">
                      To {r.new_bank_name} ending <span className="data">{r.new_account_last4}</span>
                    </p>
                  </td>
                  <td className="data hidden py-4 pr-4 text-[14px] text-mercury sm:table-cell">{dateTime(r.received_at)}</td>
                  <td className="label hidden py-4 pr-4 text-mercury md:table-cell">{CHANNEL_LABEL[r.channel] ?? r.channel}</td>
                  <td className="data py-4 text-right text-[15px] sm:text-[16px]">{money(r.amount_cents)}</td>
                  <td className="py-4 pl-4 sm:pl-8">
                    <Stamp kind={requestStamp(r.status, r.locked)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
