import Link from "next/link";
import { ResetLedger } from "@/components/reset-ledger";
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
      <p className="label text-subtle">Bank-detail changes</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="heading text-[32px] sm:text-[40px]">Payments held for verification</h1>
        {rows.length > 0 && (
          <p className="label text-muted">
            {held} held <span className="text-line-strong">/</span> {locked} locked <span className="text-line-strong">/</span> {decided} decided
          </p>
        )}
      </div>

      <section className="mt-10 rounded-[12px] border border-line bg-panel p-6">
        <p className="label text-subtle">Try it yourself</p>
        <ol className="mt-4 grid gap-4 text-[15px] leading-[1.5] text-ink-2 sm:grid-cols-3">
          <li>
            <span className="data mr-2 text-subtle">01</span>
            Open <strong className="font-medium text-ink">Northwind Steel</strong> and press <strong className="font-medium text-ink">Call vendor of record</strong>.
          </li>
          <li>
            <span className="data mr-2 text-subtle">02</span>
            On the call screen, press <strong className="font-medium text-ink">Open vendor line</strong> and answer with your microphone.
          </li>
          <li>
            <span className="data mr-2 text-subtle">03</span>
            Play the vendor. The call screen shows what the real vendor knows, so you can pass, or deny the change to see it blocked.
          </li>
        </ol>
        <p className="mt-4 text-[13px] text-subtle">
          This is a sample ledger. Brightline Print stays locked on purpose: its phone number changed six days ago. When every request is decided,
          reset the ledger for the next person.
        </p>
        <div className="mt-5">
          <ResetLedger />
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="mt-16 max-w-md text-muted">No bank-detail changes waiting. Payments release on schedule.</p>
      ) : (
        <div className="mt-12 overflow-x-auto">
          <table className="w-full sm:min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="label text-subtle">
                <th className="pb-3 font-medium">Vendor</th>
                <th className="hidden pb-3 font-medium sm:table-cell">Received</th>
                <th className="hidden pb-3 font-medium md:table-cell">Via</th>
                <th className="pb-3 text-right font-medium">Amount</th>
                <th className="pb-3 pl-4 font-medium sm:pl-8">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="group relative border-t border-line hover:bg-panel">
                  <td className="py-4 pr-4">
                    <Link href={`/requests/${r.id}`} className="text-[16px] after:absolute after:inset-0">
                      {r.vendor_name}
                    </Link>
                    <p className="mt-0.5 text-[14px] text-subtle">
                      To {r.new_bank_name} ending <span className="data">{r.new_account_last4}</span>
                    </p>
                  </td>
                  <td className="data hidden py-4 pr-4 text-[14px] text-muted sm:table-cell">{dateTime(r.received_at)}</td>
                  <td className="label hidden py-4 pr-4 text-muted md:table-cell">{CHANNEL_LABEL[r.channel] ?? r.channel}</td>
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
