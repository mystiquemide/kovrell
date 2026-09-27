import Link from "next/link";
import { notFound } from "next/navigation";
import { SECONDARY } from "@/components/button";
import { Stamp, verdictStamp } from "@/components/stamp";
import { clock, dateTime, duration, money } from "@/lib/format";
import { getStore } from "@/server/store";
import { evidenceView } from "@/server/views";
import { SHOWCASE_RUN_ID, showcaseEvidenceView } from "@/showcase";
import { Seal } from "@/components/seal";
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
  const stored = id === SHOWCASE_RUN_ID ? null : evidenceView(getStore(), id);
  const view = id === SHOWCASE_RUN_ID
    ? showcaseEvidenceView()
    : stored && { ...stored, audioSrc: `/api/runs/${id}/audio`, downloadHref: `/api/runs/${id}/evidence?download=1`, isShowcase: false };
  if (!view) notFound();
  const { run, vendor, request, checks, events, evidence, labels, record } = view;
  const provenance = ((record as { provenance_at_call?: Provenance } | null)?.provenance_at_call ?? null) as Provenance | null;
  const lines = events.filter((e) => ["agent", "vendor", "tool"].includes(e.kind));

  return (
    <div className="reveal">
      <Link href="/evidence" className="label text-subtle hover:text-ink">
        &larr; Evidence
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-subtle">
            {view.isShowcase ? "Showcase run" : "Verification run"} <span className="data normal-case text-muted">{run.id}</span>
          </p>
          <h1 className="heading mt-2 text-[32px] sm:text-[40px]">{vendor.name}</h1>
          <p className="mt-2 text-muted">
            {dateTime(run.started_at)}
            {duration(run.started_at, run.ended_at) && <> / {duration(run.started_at, run.ended_at)}</>} / Contact of record{" "}
            <span className="data">{vendor.contact_phone}</span>
          </p>
        </div>
        <Stamp kind={verdictStamp(run.verdict, run.status)} large />
      </div>

      {run.status !== "ended" ? (
        <p className="mt-10 text-muted">
          This run has not finished.{" "}
          <Link href={`/calls/${run.id}`} className="text-ink underline-offset-4 hover:underline">
            Open the live call
          </Link>
          .
        </p>
      ) : (
        <>
          {view.isShowcase && (
            <p className="mt-6 rounded-[10px] border border-line bg-panel px-4 py-3 text-[14px] text-muted">
              Showcase run recorded on this system. The agent ran live on the AssemblyAI Voice Agent API. The vendor&apos;s answers were spoken
              by a scripted test caller, against the sample ledger.
            </p>
          )}
          <p className="mt-6 text-[18px]">{run.reason}</p>
          <p className="mt-1 text-muted">
            {run.verdict === "PASS"
              ? `Payment released to ${request.new_bank_name} ending ${request.new_account_last4}.`
              : run.verdict === "FAIL"
                ? "Payment blocked. The account on file was kept."
                : "Payment stays held."}
          </p>

          <section className="mt-12">
            <p className="label text-subtle">Recording</p>
            <div className="mt-4">
              <Recording src={view.audioSrc} levels={evidence?.levels ?? []} available={Boolean(evidence?.audio_available)} />
            </div>
          </section>

          <section className="mt-14">
            <p className="label text-subtle">Checks</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="label text-subtle">
                    <th className="pb-3 font-medium">Check</th>
                    <th className="pb-3 font-medium">Expected</th>
                    <th className="pb-3 font-medium">Heard</th>
                    <th className="pb-3 text-right font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => (
                    <tr key={c.key} className="border-t border-line">
                      <td className="py-3 pr-4">{labels[c.key] ?? c.key}</td>
                      <td className="data py-3 pr-4 text-[14px] text-muted">{expectedText(c.key, c.expected) || "n/a"}</td>
                      <td className="data py-3 pr-4 text-[14px] text-muted">{c.heard ?? "Not answered"}</td>
                      <td className={`label py-3 text-right ${c.status === "pass" ? "text-pass" : c.status === "fail" ? "text-fail" : "text-subtle"}`}>
                        {c.status === "pending" ? "Not reached" : c.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] text-subtle">Expected values appear only in the evidence pack. The agent never heard them.</p>
          </section>

          {provenance && (
            <section className="mt-14">
              <p className="label text-subtle">Provenance at call time</p>
              <div className="mt-3">
                {provenance.map((p) => (
                  <div key={p.key} className="flex flex-wrap items-baseline justify-between gap-x-6 border-t border-line py-3">
                    <div>
                      <p>{p.label}</p>
                      <p className="text-[14px] text-muted">{p.detail}</p>
                    </div>
                    <span className={`label ${p.status === "ok" ? "text-pass" : p.status === "fail" ? "text-fail" : "text-muted"}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-14">
            <p className="label text-subtle">Timeline</p>
            <div className="mt-3 border-t border-line">
              {lines.map((e) => {
                const p = e.payload as { text?: string; name?: string; args?: Record<string, unknown> };
                return (
                  <div key={e.id} className="grid grid-cols-[56px_64px_1fr] gap-3 border-b border-line/60 py-2.5">
                    <span className="data text-[13px] text-subtle">{clock(e.t_ms)}</span>
                    <span className={`label ${e.kind === "agent" ? "text-ink" : e.kind === "tool" ? "text-subtle" : "text-muted"}`}>
                      {e.kind === "agent" ? "Agent" : e.kind === "tool" ? "Tool" : "Vendor"}
                    </span>
                    {e.kind === "tool" ? (
                      <span className="data text-[13px] text-subtle">
                        {p.name}({p.args?.question_id ? String(p.args.question_id) : ""})
                      </span>
                    ) : (
                      <span className={e.kind === "agent" ? "text-ink" : "text-ink-2"}>{p.text}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-14 rounded-[5.6px] border border-line bg-panel p-6">
            <p className="label text-subtle">Seal</p>
            {evidence?.sha256 ? (
              <>
                <div className="mt-3">
                  <Seal hash={evidence.sha256} downloadHref={view.downloadHref} />
                </div>
                <p className="mt-2 text-[14px] text-muted">
                  Hash over the canonical run record: request, provenance, checks with expected values, every event, and the provider
                  session. {evidence.status === "sealed" ? "Sealed with the AssemblyAI timeline." : evidence.status === "pending" ? "Waiting for the provider timeline." : "Sealed without a provider timeline."}
                  {evidence.median_response_ms !== null && ` Median agent response on this call: ${evidence.median_response_ms} ms.`}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href={`/api/runs/${run.id}/pdf`} download className={SECONDARY}>
                    Download PDF report
                  </a>
                  <a href={view.downloadHref} download className={SECONDARY}>
                    Download JSON
                  </a>
                </div>
              </>
            ) : (
              <p className="mt-3 text-muted">Sealing. The seal appears within a minute of the call ending.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
