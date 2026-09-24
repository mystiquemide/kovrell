import Link from "next/link";
import { notFound } from "next/navigation";
import { SECONDARY } from "@/components/button";
import { Stamp, verdictStamp } from "@/components/stamp";
import { clock, dateTime, duration, money } from "@/lib/format";
import { getStore } from "@/server/store";
import { evidenceView } from "@/server/views";
import { Recording } from "./recording";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evidence pack" };

type Provenance = { key: string; label: string; status: string; detail: string }[];

function expectedText(key: string, expected: string | null) {
  if (!expected) return "";
  return /^\d+\.\d{2}$/.test(expected) ? money(Math.round(Number(expected) * 100)) : expected;
}

export default async function EvidencePackPage({ params }: PageProps<"/evidence/[id]">) {
  const { id } = await params;
  const view = evidenceView(getStore(), id);
  if (!view) notFound();
  const { run, vendor, request, checks, events, evidence, labels, record } = view;
  const provenance = ((record as { provenance_at_call?: Provenance } | null)?.provenance_at_call ?? null) as Provenance | null;
  const lines = events.filter((e) => ["agent", "vendor", "tool"].includes(e.kind));

  return (
    <div className="reveal">
      <Link href="/evidence" className="label text-zinc hover:text-cream">
        &larr; Evidence
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-zinc">
            Verification run <span className="data normal-case text-mercury">{run.id}</span>
          </p>
          <h1 className="heading mt-2 text-[32px] sm:text-[40px]">{vendor.name}</h1>
          <p className="mt-2 text-mercury">
            {dateTime(run.started_at)}
            {duration(run.started_at, run.ended_at) && <> / {duration(run.started_at, run.ended_at)}</>} / Contact of record{" "}
            <span className="data">{vendor.contact_phone}</span>
          </p>
        </div>
        <Stamp kind={verdictStamp(run.verdict, run.status)} large />
      </div>

      {run.status !== "ended" ? (
        <p className="mt-10 text-mercury">
          This run has not finished.{" "}
          <Link href={`/calls/${run.id}`} className="text-cream underline-offset-4 hover:underline">
            Open the live call
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="mt-6 text-[18px]">{run.reason}</p>
          <p className="mt-1 text-mercury">
            {run.verdict === "PASS"
              ? `Payment released to ${request.new_bank_name} ending ${request.new_account_last4}.`
              : run.verdict === "FAIL"
                ? "Payment blocked. The account on file was kept."
                : "Payment stays held."}
          </p>

          <section className="mt-12">
            <p className="label text-zinc">Recording</p>
            <div className="mt-4">
              <Recording runId={run.id} levels={evidence?.levels ?? []} available={Boolean(evidence?.audio_available)} />
            </div>
          </section>

          <section className="mt-14">
            <p className="label text-zinc">Checks</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="label text-zinc">
                    <th className="pb-3 font-medium">Check</th>
                    <th className="pb-3 font-medium">Expected</th>
                    <th className="pb-3 font-medium">Heard</th>
                    <th className="pb-3 text-right font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => (
                    <tr key={c.key} className="border-t border-iron">
                      <td className="py-3 pr-4">{labels[c.key] ?? c.key}</td>
                      <td className="data py-3 pr-4 text-[14px] text-mercury">{expectedText(c.key, c.expected) || "n/a"}</td>
                      <td className="data py-3 pr-4 text-[14px] text-mercury">{c.heard ?? "Not answered"}</td>
                      <td className={`label py-3 text-right ${c.status === "pass" ? "text-mint" : c.status === "fail" ? "text-ember" : "text-zinc"}`}>
                        {c.status === "pending" ? "Not reached" : c.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] text-zinc">Expected values appear only in the evidence pack. The agent never heard them.</p>
          </section>

          {provenance && (
            <section className="mt-14">
              <p className="label text-zinc">Provenance at call time</p>
              <div className="mt-3">
                {provenance.map((p) => (
                  <div key={p.key} className="flex flex-wrap items-baseline justify-between gap-x-6 border-t border-iron py-3">
                    <div>
                      <p>{p.label}</p>
                      <p className="text-[14px] text-mercury">{p.detail}</p>
                    </div>
                    <span className={`label ${p.status === "ok" ? "text-mint" : p.status === "fail" ? "text-ember" : "text-mercury"}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-14">
            <p className="label text-zinc">Timeline</p>
            <div className="mt-3 border-t border-iron">
              {lines.map((e) => {
                const p = e.payload as { text?: string; name?: string; args?: Record<string, unknown> };
                return (
                  <div key={e.id} className="grid grid-cols-[56px_64px_1fr] gap-3 border-b border-iron/60 py-2.5">
                    <span className="data text-[13px] text-zinc">{clock(e.t_ms)}</span>
                    <span className={`label ${e.kind === "agent" ? "text-cream" : e.kind === "tool" ? "text-zinc" : "text-mercury"}`}>
                      {e.kind === "agent" ? "Agent" : e.kind === "tool" ? "Tool" : "Vendor"}
                    </span>
                    {e.kind === "tool" ? (
                      <span className="data text-[13px] text-zinc">
                        {p.name}({p.args?.question_id ? String(p.args.question_id) : ""})
                      </span>
                    ) : (
                      <span className={e.kind === "agent" ? "text-cream" : "text-bone"}>{p.text}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-14 rounded-[5.6px] border border-iron bg-carbon p-6">
            <p className="label text-zinc">Seal</p>
            {evidence?.sha256 ? (
              <>
                <p className="data mt-3 break-all text-[14px]">sha256 {evidence.sha256}</p>
                <p className="mt-2 text-[14px] text-mercury">
                  Hash over the canonical run record: request, provenance, checks with expected values, every event, and the provider
                  session. {evidence.status === "sealed" ? "Sealed with the AssemblyAI timeline." : evidence.status === "pending" ? "Waiting for the provider timeline." : "Sealed without a provider timeline."}
                  {evidence.median_response_ms !== null && ` Median agent response on this call: ${evidence.median_response_ms} ms.`}
                </p>
                <a href={`/api/runs/${run.id}/evidence?download=1`} className={`${SECONDARY} mt-5`}>
                  Download JSON
                </a>
              </>
            ) : (
              <p className="mt-3 text-mercury">Sealing. The seal appears within a minute of the call ending.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
