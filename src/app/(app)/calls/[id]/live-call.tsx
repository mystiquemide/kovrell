"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SECONDARY } from "@/components/button";
import { CallButton } from "@/components/call-button";
import { Mark } from "@/components/mark";
import { Stamp, verdictStamp } from "@/components/stamp";
import { Waveform } from "@/components/waveform";
import { clock, money } from "@/lib/format";
import type { runView } from "@/server/views";

type View = NonNullable<ReturnType<typeof runView>>;
type Event = View["events"][number];
type Check = View["checks"][number];

const LIVE_BARS = 120;

function payloadOf<T>(e: Event) {
  return e.payload as T;
}

export function LiveCall({ initial, callPath }: { initial: View; callPath: string | null }) {
  const router = useRouter();
  const [run, setRun] = useState(initial.run);
  const [events, setEvents] = useState<Event[]>(initial.events);
  const [checks, setChecks] = useState<Check[]>(initial.checks);
  const [partial, setPartial] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(LIVE_BARS).fill(0));
  const [now, setNow] = useState(() => Date.now());
  // Browser origin (localhost, tunnel, or deploy). Empty during server render.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const ended = run.status === "ended";
  const expired = run.status === "ringing" && Date.parse(run.token_expires_at) < now;

  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ended]);

  // Live feed: snapshot, then events, partial transcripts, and audio levels.
  useEffect(() => {
    if (ended) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws/watch/${run.id}`);
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.type === "snapshot") {
        setRun(msg.run);
        setEvents(msg.events);
        setChecks(msg.checks);
      } else if (msg.type === "event") {
        const e: Event = msg.event;
        setEvents((prev) => (prev.some((p) => p.id === e.id) ? prev : [...prev, e]));
        if (e.kind === "vendor") setPartial(null);
        if (e.kind === "check") {
          const c = payloadOf<{ check: { key: string; status: string; heard: string | null } }>(e).check;
          setChecks((prev) => prev.map((p) => (p.key === c.key ? { ...p, status: c.status, heard: c.heard } : p)));
        }
        if (e.kind === "state") {
          const s = payloadOf<{ state: string }>(e).state;
          if (s === "answered") setRun((r) => ({ ...r, status: "live" }));
        }
        if (e.kind === "outcome") {
          const o = payloadOf<{ verdict: View["run"]["verdict"]; reason: string }>(e);
          setRun((r) => ({ ...r, status: "ended", verdict: o.verdict, reason: o.reason, ended_at: new Date().toISOString() }));
          router.refresh();
        }
      } else if (msg.type === "partial") {
        setPartial(msg.text);
      } else if (msg.type === "level") {
        setLevels((prev) => [...prev.slice(1), Math.max(msg.agent, msg.vendor)]);
      }
    };
    return () => ws.close();
  }, [run.id, ended, router]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: "nearest" });
  }, [events.length, partial]);

  const answeredAt = useMemo(() => {
    const e = events.find((x) => x.kind === "state" && payloadOf<{ state: string }>(x).state === "answered");
    return e ? Date.parse(run.started_at) + e.t_ms : null;
  }, [events, run.started_at]);
  const endedAt = run.ended_at ? Date.parse(run.ended_at) : null;
  const elapsed = answeredAt ? (endedAt ?? now) - answeredAt : 0;
  const lines = events.filter((e) => e.kind === "agent" || e.kind === "vendor" || e.kind === "tool" || e.kind === "error");
  const callUrl = callPath && origin ? `${origin}${callPath}` : null;
  const payment = initial.payment;

  return (
    <div className="reveal">
      <Link href={`/requests/${run.request_id}`} className="label text-zinc hover:text-cream">
        &larr; {initial.vendor.name}
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-zinc">
            {ended ? "Verification run" : run.status === "live" ? "Calling" : expired ? "Call link expired" : "Ringing"}{" "}
            <span className="data text-mercury normal-case">{initial.vendor.contact_phone}</span>
          </p>
          <h1 className="heading mt-2 text-[32px] sm:text-[40px]">
            {initial.vendor.contact_name}, {initial.vendor.name}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {answeredAt && <span className="data text-[20px] text-mercury">{clock(elapsed)}</span>}
          <Stamp kind={verdictStamp(run.verdict, expired ? "ended" : run.status)} large />
        </div>
      </div>

      {ended && <Verdict view={initial} run={run} />}

      {!ended && run.status === "ringing" && !expired && (
        <section className="mt-10 rounded-[5.6px] border border-iron bg-carbon p-6">
          <p className="label text-zinc">Call link for the contact of record</p>
          <p className="data mt-3 break-all text-[14px] text-cream">{callUrl ?? "Preparing link"}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              className={SECONDARY}
              disabled={!callUrl}
              onClick={async () => {
                if (!callUrl) return;
                await navigator.clipboard.writeText(callUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            {callUrl && (
              <a href={callUrl} target="_blank" rel="noreferrer" className={SECONDARY}>
                Open vendor line
              </a>
            )}
            <span className="text-[14px] text-mercury">Expires in {clock(Date.parse(run.token_expires_at) - now)}.</span>
          </div>
          <p className="mt-4 text-[14px] text-zinc">
            This build rings the vendor in a browser softphone. In production the link goes by SMS to the number of record, or the
            call is placed on the phone line directly.
          </p>
        </section>
      )}

      {expired && !ended && (
        <section className="mt-10 border-t border-iron pt-8">
          <p className="text-mercury">Nobody answered within 15 minutes. The payment stays held.</p>
          <div className="mt-5">
            <CallButton requestId={run.request_id} contactName={initial.vendor.contact_name} disabledReason={null} label="Call again" />
          </div>
        </section>
      )}

      {run.status === "live" && <Waveform levels={levels} height={56} className="mt-10 overflow-hidden" />}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <section>
          <p className="label text-zinc">Transcript</p>
          <div className="mt-3 max-h-[520px] overflow-y-auto border-t border-iron">
            {lines.length === 0 && !partial && (
              <p className="py-4 text-mercury">{run.status === "ringing" ? "Waiting for the vendor to answer." : "Connecting to the voice agent."}</p>
            )}
            {lines.map((e) => (
              <Line key={e.id} e={e} />
            ))}
            {partial && (
              <div className="grid grid-cols-[56px_64px_1fr] gap-3 py-3">
                <span />
                <span className="label text-mercury">Vendor</span>
                <span className="text-mercury">{partial}</span>
              </div>
            )}
            <div ref={transcriptEnd} />
          </div>
        </section>

        <aside>
          <p className="label text-zinc">Checks</p>
          <div className="mt-3 border-t border-iron">
            {checks.map((c) => (
              <div key={c.key} className="border-b border-iron py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px]">{initial.labels[c.key] ?? c.key}</span>
                  <span className={`label ${c.status === "pass" ? "text-mint" : c.status === "fail" ? "text-ember" : "text-zinc"}`}>
                    {c.status === "pending" ? "Waiting" : c.status}
                  </span>
                </div>
                {c.heard && <p className="data mt-1 text-[13px] text-mercury">{c.heard}</p>}
              </div>
            ))}
            {checks.length === 0 && <p className="py-3 text-[14px] text-mercury">Checks start when the vendor answers.</p>}
          </div>

          <p className="label mt-8 text-zinc">Payment</p>
          <div className="mt-3 flex items-center justify-between border-t border-iron pt-3">
            <span className="data text-[18px]">{money(payment.amount_cents)}</span>
            <Stamp kind={run.verdict === "PASS" ? "VERIFIED" : run.verdict === "FAIL" ? "BLOCKED" : "HELD"} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Line({ e }: { e: Event }) {
  const t = <span className="data text-[13px] text-zinc">{clock(e.t_ms)}</span>;
  if (e.kind === "tool") {
    const p = payloadOf<{ name: string; args: Record<string, unknown> }>(e);
    const arg = p.args.question_id ? `(${String(p.args.question_id)})` : "";
    return (
      <div className="grid grid-cols-[56px_64px_1fr] gap-3 py-2">
        {t}
        <span className="label text-zinc">Tool</span>
        <span className="data text-[13px] text-zinc">
          {p.name}
          {arg}
        </span>
      </div>
    );
  }
  if (e.kind === "error") {
    const p = payloadOf<{ code: string; message: string }>(e);
    return (
      <div className="grid grid-cols-[56px_64px_1fr] gap-3 py-2">
        {t}
        <span className="label text-ember">Error</span>
        <span className="text-[14px] text-ember">{p.message}</span>
      </div>
    );
  }
  const text = payloadOf<{ text: string }>(e).text;
  const agent = e.kind === "agent";
  return (
    <div className="grid grid-cols-[56px_64px_1fr] gap-3 border-b border-iron/60 py-3 last:border-b-0">
      {t}
      <span className={`label ${agent ? "text-cream" : "text-mercury"}`}>{agent ? "Agent" : "Vendor"}</span>
      <span className={agent ? "text-cream" : "text-bone"}>{text}</span>
    </div>
  );
}

function Verdict({ view, run }: { view: View; run: View["run"] }) {
  const pass = run.verdict === "PASS";
  const fail = run.verdict === "FAIL";
  return (
    <section className="mt-10 rounded-[5.6px] border border-iron bg-carbon p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Mark size={24} verified={pass} />
        <p className={`label ${pass ? "text-mint" : fail ? "text-ember" : "text-mercury"}`}>
          {pass ? "Verified" : fail ? "Blocked" : "Inconclusive"}
        </p>
      </div>
      <p className="heading mt-4 text-[28px] sm:text-[32px]">
        {pass
          ? `Released to ${view.request.new_bank_name} account ending ${view.request.new_account_last4}.`
          : fail
            ? "Payment blocked. Account on file kept."
            : "Payment stays held."}
      </p>
      <p className="mt-2 text-mercury">{run.reason}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link href={`/evidence/${run.id}`} className={SECONDARY}>
          Evidence pack
        </Link>
        {run.verdict === "INCONCLUSIVE" && (
          <CallButton requestId={run.request_id} contactName={view.vendor.contact_name} disabledReason={null} label="Call again" />
        )}
      </div>
    </section>
  );
}
