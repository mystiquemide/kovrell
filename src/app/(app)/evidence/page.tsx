import Link from "next/link";
import { Stamp, verdictStamp } from "@/components/stamp";
import { dateTime, duration } from "@/lib/format";
import { getStore } from "@/server/store";
import { runListView } from "@/server/views";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evidence" };

export default function EvidencePage() {
  const runs = runListView(getStore());
  return (
    <div className="reveal">
      <p className="label text-subtle">Evidence</p>
      <h1 className="heading mt-3 text-[32px] sm:text-[40px]">Every verification run, sealed.</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Each run keeps the recording, the transcript, every tool call, and the checks, sealed with a sha256 over the full record.
      </p>

      {runs.length === 0 ? (
        <p className="mt-16 text-muted">
          No verification runs yet.{" "}
          <Link href="/requests" className="text-ink underline-offset-4 hover:underline">
            Start one from Requests
          </Link>
          .
        </p>
      ) : (
        <div className="mt-12 overflow-x-auto">
          <table className="w-full sm:min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="label text-subtle">
                <th className="pb-3 font-medium">Run</th>
                <th className="pb-3 font-medium">Vendor</th>
                <th className="hidden pb-3 font-medium md:table-cell">Started</th>
                <th className="hidden pb-3 font-medium sm:table-cell">Length</th>
                <th className="pb-3 font-medium">Verdict</th>
                <th className="hidden pb-3 font-medium lg:table-cell">Seal</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="relative border-t border-line hover:bg-panel">
                  <td className="data py-4 pr-4 text-[14px]">
                    <Link href={r.status === "ended" ? `/evidence/${r.id}` : `/calls/${r.id}`} className="after:absolute after:inset-0">
                      {r.id}
                    </Link>
                  </td>
                  <td className="py-4 pr-4">{r.vendor_name}</td>
                  <td className="data hidden py-4 pr-4 text-[14px] text-muted md:table-cell">{dateTime(r.started_at)}</td>
                  <td className="data hidden py-4 pr-4 text-[14px] text-muted sm:table-cell">{duration(r.started_at, r.ended_at) ?? "Open"}</td>
                  <td className="py-4 pr-4">
                    <Stamp kind={verdictStamp(r.verdict, r.status)} />
                  </td>
                  <td className="data hidden py-4 text-[13px] text-subtle lg:table-cell">
                    {r.sha256 ? `${r.sha256.slice(0, 8)}...${r.sha256.slice(-4)}` : r.status === "ended" ? "Sealing" : "Not sealed"}
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
