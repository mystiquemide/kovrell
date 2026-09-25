import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow, PRIMARY, SECONDARY } from "@/components/button";
import { Mark, Wordmark } from "@/components/mark";
import { Stamp } from "@/components/stamp";
import { clock, dateOnly, money } from "@/lib/format";
import { SHOWCASE_AUDIO, SHOWCASE_RECORD, callLengthMs, checkTimeline, milestones, showcase, transcript } from "@/showcase";
import { HeroCall, PlayCallButton, RecordingWave, ShowcasePlayer } from "./_landing/player";
import { ScrollLink } from "./_landing/scroll-link";

const AFP_RELEASE =
  "https://www.financialprofessionals.org/about/learn-more/press-releases/Details/over-75-percent-of-us-firms-experienced-payments-fraud-in-2025-while-ai-adoption-for-fraud-mitigation-lags";
const AFP_HIGHLIGHTS =
  "https://www.truist.com/content/dam/truist-bank/us/en/documents/info/cci/2026-afp-payments-fraud-control-survey-report-key-highlights.pdf";

const STATS = [
  { n: "76%", text: "of US organizations faced attempted or actual payments fraud in 2025", source: "AFP 2026 press release", href: AFP_RELEASE },
  { n: "74%", text: "were hit by business email compromise, mostly vendor or executive impersonation", source: "AFP 2026, PDF p. 6", href: `${AFP_HIGHLIGHTS}#page=6` },
  { n: "94%", text: "call back on a number from official records. Only 63% rate it very effective", source: "AFP 2026, PDF p. 15", href: `${AFP_HIGHLIGHTS}#page=15` },
  { n: "17%", text: "use AI against payments fraud", source: "AFP 2026 press release", href: AFP_RELEASE },
];

const CONTROLS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Number of record only",
    body: "Kovrell calls the contact in your vendor master. A callback number inside the request is logged and never used.",
    icon: <path d="M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  },
  {
    title: "Provenance lock",
    body: "If the number of record changed in the last 30 days, the call is locked and a person has to verify.",
    icon: <path d="M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z" />,
  },
  {
    title: "Ledger challenge",
    body: "Three questions only the real vendor can answer, drawn from invoices and payments. The agent never speaks the answers.",
    icon: <path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7" />,
  },
  {
    title: "One attempt per question",
    body: "The first answer counts. Retries are logged and ignored, so a caller cannot guess their way through.",
    icon: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 3" />,
  },
  {
    title: "Fixed verdict rules",
    body: "The model collects answers. Code decides: pass releases, fail blocks, anything else keeps the payment held.",
    icon: <path d="M4 6h16M4 12h16M4 18h10" />,
  },
  {
    title: "Sealed evidence",
    body: "Recording, transcript, every tool call, and expected versus heard answers, sealed with sha256.",
    icon: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" />,
  },
];

/** Section wrapper with the ledger rails: hairline column edges down the page. */
function Rail({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`border-b border-line ${className}`}>
      <div className="mx-auto max-w-[1200px] border-x border-line">{children}</div>
    </section>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[14px] border border-line bg-white">{children}</div>;
}

export default function Landing() {
  const run = showcase;
  const steps = milestones();
  const checks = checkTimeline();
  const lines = transcript();
  const recordedOn = dateOnly(run.recorded_at);
  const flow = [
    { label: "Bank change email", note: "Request arrives", t: steps[0].t },
    { label: "Payment held", note: money(run.payment.amount_cents), t: steps[0].t },
    { label: "Number of record", note: "Provenance checked", t: steps[1].t },
    { label: "Voice call", note: "AssemblyAI agent", t: steps[2].t },
    { label: "Ledger challenge", note: "3 of 3 correct", t: steps[3].t },
    { label: "Verified", note: "Payment released", t: steps[4].t },
    { label: "Evidence sealed", note: "sha256", t: steps[5].t },
  ];

  return (
    <ShowcasePlayer src={SHOWCASE_AUDIO}>
      <div className="flex flex-1 flex-col bg-canvas">
        {/* Nav */}
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-sm">
          <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between border-x border-line px-4 sm:px-8">
            <Wordmark />
            <nav className="hidden items-center gap-8 font-tight text-[15px] font-medium md:flex">
              <ScrollLink to="how" className="text-muted hover:text-ink">
                How it works
              </ScrollLink>
              <ScrollLink to="evidence" className="text-muted hover:text-ink">
                Evidence
              </ScrollLink>
              <ScrollLink to="numbers" className="text-muted hover:text-ink">
                Numbers
              </ScrollLink>
            </nav>
            <Link href="/requests" className={PRIMARY}>
              <span className="sm:hidden">See it live</span>
              <span className="hidden sm:inline">See a live verification</span>
            </Link>
          </div>
        </header>

        {/* Hero */}
        <Rail>
          <div className="px-4 pb-16 pt-20 text-center sm:px-8 sm:pb-20 sm:pt-28">
            <p className="eyebrow reveal text-subtle">Voice verification for vendor payments</p>
            <h1 className="display reveal mx-auto mt-6 max-w-[900px] text-[52px] text-ink sm:text-[88px]">
              Kovrell calls the vendor <em className="italic">before you pay.</em>
            </h1>
            <p className="reveal mx-auto mt-6 max-w-[580px] text-[18px] leading-[1.5] text-muted">
              A voice agent verifies every bank-detail change on the vendor&apos;s number of record, asks what only the real vendor knows, and
              holds the payment until it checks out.
            </p>
            <div className="reveal mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/requests" className={PRIMARY}>
                See a live verification <Arrow />
              </Link>
              <ScrollLink to="how" className={SECONDARY}>
                How it works
              </ScrollLink>
            </div>
            <div className="reveal mt-14">
              <HeroCall
                title={`${run.vendor.name}, ${money(run.payment.amount_cents)} bank change`}
                meta={`${recordedOn}. ${clock(callLengthMs())} call to ${run.vendor.contact_name}, the contact of record.`}
                levels={run.levels}
                stamp={<Stamp kind="VERIFIED" />}
              />
            </div>
          </div>
        </Rail>

        {/* Flow rail */}
        <Rail>
          <div className="px-4 py-12 sm:px-8">
            <p className="eyebrow text-center text-subtle">One verification run, as it happened</p>
            <ol className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {flow.map((f, i) => (
                <li key={f.label} className="relative">
                  <div className={`rounded-[10px] border px-3 py-3 ${i >= 5 ? "border-pass/40 bg-tint" : "border-line bg-white"}`}>
                    <p className="data text-[11px] text-subtle">{f.t === null ? "--:--" : clock(f.t)}</p>
                    <p className={`subheading mt-1 text-[14px] ${i >= 5 ? "text-pass" : "text-ink"}`}>{f.label}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{f.note}</p>
                  </div>
                  {i < flow.length - 1 && <span aria-hidden="true" className="absolute left-full top-1/2 hidden h-px w-3 bg-line-strong lg:block" />}
                </li>
              ))}
            </ol>
          </div>
        </Rail>

        {/* Problem and solution */}
        <Rail id="how">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="border-b border-line px-4 py-16 sm:px-10 lg:border-b-0 lg:border-r">
              <p className="eyebrow text-fail">The problem</p>
              <h2 className="heading mt-4 text-[40px] text-ink sm:text-[52px]">The control exists. People skip it.</h2>
              <p className="mt-5 max-w-[460px] text-[17px] leading-[1.55] text-muted">
                94% of companies say they call the vendor back on a number from official records before moving money. Only 63% say that
                control works well. A busy team skips the call, or confirms on the same email thread the fraudster wrote from.
              </p>
              <a
                href={`${AFP_HIGHLIGHTS}#page=15`}
                target="_blank"
                rel="noreferrer"
                className="label mt-6 inline-block text-subtle underline underline-offset-4 hover:text-ink"
              >
                AFP 2026 Payments Fraud and Control Survey, PDF p. 15
              </a>
            </div>
            <div className="bg-panel px-4 py-16 sm:px-10">
              <p className="eyebrow text-pass">The solution</p>
              <h2 className="heading mt-4 text-[40px] text-ink sm:text-[52px]">Hold the payment. Make the call. Every time.</h2>
              <p className="mt-5 max-w-[460px] text-[17px] leading-[1.55] text-muted">
                When an email asks to move {money(run.payment.amount_cents)} to a new bank, Kovrell holds the payment, ignores the callback number
                in the email, and checks the number of record before it dials.
              </p>
              <div className="mt-8">
                <Panel>
                  <div className="flex items-start justify-between gap-4 border-b border-line p-5">
                    <div>
                      <p className="subheading text-[16px] text-ink">{run.vendor.name}</p>
                      <p className="mt-0.5 text-[13px] text-muted">Bank change by email. Contact of record {run.vendor.contact_name}.</p>
                    </div>
                    <div className="text-right">
                      <p className="data text-[18px] text-ink">{money(run.payment.amount_cents)}</p>
                      <Stamp kind="HELD" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 border-b border-line">
                    <div className="border-r border-line p-5">
                      <p className="label text-subtle">On file</p>
                      <p className="mt-1.5 text-[14px] text-ink">
                        {run.on_file.bank_name} <span className="data">{run.on_file.account_last4}</span>
                      </p>
                    </div>
                    <div className="p-5">
                      <p className="label text-subtle">Requested</p>
                      <p className="mt-1.5 text-[14px] text-ink">
                        {run.request.new_bank_name} <span className="data">{run.request.new_account_last4}</span>
                      </p>
                    </div>
                  </div>
                  <div className="px-5 py-2">
                    {run.provenance?.map((p) => (
                      <div key={p.key} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
                        <span className="text-[14px] text-ink">
                          {p.label}
                          <span className="block text-[12px] text-muted">{p.detail}</span>
                        </span>
                        <span className={`label ${p.status === "ok" ? "text-pass" : "text-muted"}`}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </Rail>

        {/* The call */}
        <Rail>
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
            <div className="order-2 min-w-0 border-line bg-tint px-4 py-16 sm:px-10 lg:order-1 lg:border-r">
              <Panel>
                <div className="flex items-center justify-between border-b border-line p-5">
                  <p className="text-[14px] text-ink">
                    Calling {run.vendor.contact_name} <span className="data text-muted">{run.vendor.contact_phone}</span>
                  </p>
                  <Stamp kind="VERIFIED" />
                </div>
                <div className="px-5 pt-4">
                  <RecordingWave levels={run.levels} height={40} />
                </div>
                <div className="px-5 py-2">
                  {checks.map((c) => (
                    <div key={c.key} className="grid grid-cols-[48px_1fr_auto] items-baseline gap-3 border-b border-line py-2.5 last:border-b-0">
                      <span className="data text-[12px] text-subtle">{clock(c.t)}</span>
                      <span className="text-[14px] text-ink">
                        {c.label}
                        {c.heard && <span className="data block text-[12px] text-muted">Heard: {c.heard}</span>}
                      </span>
                      <span className="label text-pass">{c.status}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
            <div className="order-1 min-w-0 border-b border-line px-4 py-16 sm:px-10 lg:order-2 lg:border-b-0">
              <p className="eyebrow text-subtle">The call</p>
              <h2 className="heading mt-4 text-[40px] text-ink sm:text-[52px]">It asks what only the real vendor knows.</h2>
              <p className="mt-5 max-w-[440px] text-[17px] leading-[1.55] text-muted">
                Three questions from the ledger, one attempt each. The agent never says the answers and never says whether one was right. Fixed
                rules released this payment to {run.request.new_bank_name} ending {run.request.new_account_last4}.
              </p>
              <PlayCallButton className={`${SECONDARY} mt-8`} />
            </div>
          </div>
        </Rail>

        {/* Evidence */}
        <Rail id="evidence">
          <div className="px-4 py-20 sm:px-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow text-subtle">The evidence</p>
                <h2 className="heading mt-4 max-w-[560px] text-[40px] text-ink sm:text-[52px]">Every run leaves a sealed record.</h2>
              </div>
              <a href={SHOWCASE_RECORD} download className={PRIMARY}>
                Download the sealed record <Arrow />
              </a>
            </div>
            <div className="mt-10 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel>
                <div className="p-5">
                  <p className="label text-subtle">Transcript</p>
                  <div className="mt-3 max-h-[360px] overflow-y-auto">
                    {lines.map((l, i) => (
                      <div key={i} className="border-t border-line py-2.5">
                        <p className="label text-subtle">
                          {clock(l.t)} <span className={l.who === "agent" ? "text-ink" : "text-muted"}>{l.who === "agent" ? "Agent" : "Vendor"}</span>
                        </p>
                        <p className="mt-1 text-[14px] text-ink">{l.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
              <Panel>
                <div className="p-5">
                  <p className="label text-subtle">Expected vs heard</p>
                  {checks
                    .filter((c) => c.expected)
                    .map((c) => (
                      <div key={c.key} className="mt-3 border-t border-line pt-3">
                        <p className="text-[14px] text-ink">{c.label}</p>
                        <p className="data mt-1 text-[12px] text-muted">
                          Expected {/^\d+\.\d{2}$/.test(c.expected!) ? money(Math.round(Number(c.expected) * 100)) : c.expected}. Heard {c.heard}.
                        </p>
                      </div>
                    ))}
                  <p className="mt-4 text-[12px] text-subtle">Expected values stay on the server. The agent never hears them.</p>
                </div>
              </Panel>
              <Panel>
                <div className="p-5">
                  <p className="label text-subtle">Verdict and seal</p>
                  <div className="mt-4 flex items-center gap-3">
                    <Mark size={24} verified />
                    <Stamp kind="VERIFIED" />
                  </div>
                  <p className="mt-3 text-[14px] text-ink">
                    Released to {run.request.new_bank_name} ending {run.request.new_account_last4}.
                  </p>
                  <p className="mt-1 text-[13px] text-muted">{run.run.reason}</p>
                  <p className="data mt-5 break-all border-t border-line pt-4 text-[12px] text-muted">sha256 {run.sha256}</p>
                </div>
              </Panel>
            </div>
          </div>
        </Rail>

        {/* Controls */}
        <Rail>
          <div className="grid grid-cols-1 gap-12 px-4 py-20 sm:px-10 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="eyebrow text-subtle">Built for audit</p>
              <h2 className="heading mt-4 text-[40px] text-ink sm:text-[48px]">Controls that hold up.</h2>
            </div>
            <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
              {CONTROLS.map((c) => (
                <div key={c.title} className="grid grid-cols-[24px_1fr] gap-3">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="mt-0.5 text-pass"
                  >
                    {c.icon}
                  </svg>
                  <div>
                    <p className="subheading text-[17px] text-ink">{c.title}</p>
                    <p className="mt-1.5 text-[15px] leading-[1.5] text-muted">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Rail>

        {/* Built on */}
        <Rail className="bg-panel">
          <div className="flex flex-col items-start gap-8 px-4 py-16 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow text-subtle">Built on</p>
              <a href="https://www.assemblyai.com/products/voice-agent-api" target="_blank" rel="noreferrer" className="mt-5 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tech/assemblyai.svg" alt="AssemblyAI" width={161} height={28} className="h-9 w-auto" />
              </a>
            </div>
            <p className="max-w-[560px] text-[17px] leading-[1.55] text-muted">
              Every Kovrell call runs live on the <span className="text-ink">AssemblyAI Voice Agent API</span>: speech-to-text, turn-taking, tool
              calls, the agent&apos;s voice, and the session recording that seals each evidence pack.
            </p>
          </div>
        </Rail>

        {/* Numbers */}
        <Rail id="numbers">
          <div className="px-4 py-20 sm:px-10">
            <h2 className="heading text-center text-[40px] text-ink sm:text-[52px]">Payments fraud, by the numbers.</h2>
            <div className="mt-12 grid grid-cols-2 gap-y-10 lg:grid-cols-5">
              {STATS.map((s) => (
                <div key={s.n} className="border-line px-4 text-center lg:border-l lg:first:border-l-0">
                  <p className="display text-[56px] text-ink sm:text-[64px]">{s.n}</p>
                  <p className="mx-auto mt-2 max-w-[220px] text-[14px] leading-[1.45] text-muted">{s.text}</p>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="label mt-3 inline-block text-subtle underline-offset-4 hover:text-ink hover:underline"
                  >
                    {s.source}
                  </a>
                </div>
              ))}
              {run.median_response_ms !== null && (
                <div className="border-line px-4 text-center lg:border-l">
                  <p className="display text-[56px] text-ink sm:text-[64px]">{(run.median_response_ms / 1000).toFixed(1)}s</p>
                  <p className="mx-auto mt-2 max-w-[220px] text-[14px] leading-[1.45] text-muted">from the vendor finishing a sentence to the agent speaking</p>
                  <p className="label mt-3 text-subtle">Measured on this run</p>
                </div>
              )}
            </div>
          </div>
        </Rail>

        {/* Close */}
        <Rail className="bg-tint">
          <div className="px-4 py-24 text-center sm:px-10">
            <h2 className="display mx-auto max-w-[760px] text-[48px] text-ink sm:text-[72px]">
              Verify the vendor <em className="italic">before</em> you release the payment.
            </h2>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/requests" className={PRIMARY}>
                See a live verification <Arrow />
              </Link>
              <PlayCallButton className={SECONDARY} />
            </div>
          </div>
        </Rail>

        {/* Footer */}
        <footer className="bg-canvas">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-start justify-between gap-10 border-x border-line px-4 py-14 sm:px-10">
            <Wordmark />
            <div className="grid grid-cols-2 gap-x-16 gap-y-2">
              <p className="label text-subtle">Product</p>
              <p className="label text-subtle">Proof</p>
              <Link href="/requests" className="text-[14px] text-muted hover:text-ink">
                Requests
              </Link>
              <ScrollLink to="evidence" className="text-[14px] text-muted hover:text-ink">
                Evidence
              </ScrollLink>
              <Link href="/vendors" className="text-[14px] text-muted hover:text-ink">
                Vendors
              </Link>
              <ScrollLink to="numbers" className="text-[14px] text-muted hover:text-ink">
                Numbers
              </ScrollLink>
              <Link href="/evidence" className="text-[14px] text-muted hover:text-ink">
                Runs
              </Link>
              <a href={SHOWCASE_RECORD} download className="text-[14px] text-muted hover:text-ink">
                Sealed record
              </a>
            </div>
          </div>
        </footer>
      </div>
    </ShowcasePlayer>
  );
}
