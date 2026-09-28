import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow, ON_PHOTO_DARK, ON_PHOTO_LIGHT, PRIMARY, SECONDARY } from "@/components/button";
import { Mark, Wordmark } from "@/components/mark";
import { Seal } from "@/components/seal";
import { Stamp } from "@/components/stamp";
import { clock, dateOnly, money } from "@/lib/format";
import { SHOWCASE_AUDIO, SHOWCASE_AUDIO_START_MS, SHOWCASE_RECORD, callLengthMs, checkTimeline, milestones, showcase, transcript } from "@/showcase";
import { BandPlay, CallBar, LiveChecks, RecordingWave, ShowcasePlayer } from "./_landing/player";
import { ScrollLink } from "./_landing/scroll-link";

const PILOT_MAILTO =
  "mailto:splashmediahub@gmail.com?subject=Kovrell%20pilot%20request&body=Company%3A%0AAP%20team%20size%3A%0AVendors%20paid%20per%20month%3A%0AHow%20you%20verify%20bank%20changes%20today%3A%0A";

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

const INTEGRATION = [
  { title: "Sync vendors and paid invoices", body: "The contact of record, the bank on file, and recent paid invoices, from your vendor master.", code: "POST /api/vendors" },
  { title: "Hold the payment on a bank change", body: "Send each change request. The vendor's next payment is held until a call decides it.", code: "POST /api/requests" },
  { title: "Get a signed verdict", body: "When the call ends, your webhook gets the verdict and payment status, signed with HMAC-SHA256.", code: "verification.completed" },
  { title: "File the evidence", body: "Every run has a sealed JSON record and a PDF report for the audit file.", code: "GET /api/runs/:id/pdf" },
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
    body: "Three questions only the real vendor can answer, drawn at random from recent paid invoices on every call. The agent never hears the answers.",
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

function ProductFrame({ image, children }: { image: string; children: ReactNode }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[14px]">
      <Image src={image} alt="" fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
      <div className="relative p-5 sm:p-10">
        <div className="theme-dark overflow-hidden rounded-[10px] border border-line bg-canvas/95 text-ink">{children}</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const run = showcase;
  const steps = milestones();
  const checks = checkTimeline();
  const lines = transcript();
  const recordedOn = dateOnly(run.recorded_at);
  const barLabel = `${run.vendor.name}, ${clock(callLengthMs())}, verified`;

  return (
    <ShowcasePlayer src={SHOWCASE_AUDIO}>
      <div className="flex flex-1 flex-col bg-canvas">
        {/* Nav */}
        <header className="sticky top-0 z-30 border-b border-line bg-canvas">
          <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-4 sm:px-8">
            <Link href="/" aria-label="Kovrell home">
              <Wordmark />
            </Link>
            <nav className="hidden items-center gap-9 font-display text-[15px] font-medium md:flex">
              <ScrollLink to="how" className="text-ink hover:text-subtle">
                How it works
              </ScrollLink>
              <ScrollLink to="evidence" className="text-ink hover:text-subtle">
                Evidence
              </ScrollLink>
              <ScrollLink to="numbers" className="text-ink hover:text-subtle">
                Numbers
              </ScrollLink>
            </nav>
            <Link href="/requests" className={SECONDARY}>
              <span className="sm:hidden">See it live</span>
              <span className="hidden sm:inline">See a live verification</span>
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="relative isolate flex min-h-[640px] items-end overflow-hidden sm:min-h-[760px]">
          <Image src="/images/forest-motion.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-black/35" />
          <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-end gap-10 px-4 pb-16 pt-32 sm:px-8 sm:pb-24 lg:grid-cols-[1fr_380px]">
            <div className="min-w-0">
            <h1 className="display reveal max-w-[760px] text-[48px] text-white sm:text-[80px]">Kovrell calls the vendor before you pay.</h1>
            <p className="reveal mt-6 max-w-[560px] text-[18px] leading-[1.45] text-white/90">
              A voice agent verifies every bank-detail change on the vendor&apos;s number of record, asks what only the real vendor knows,
              and holds the payment until it checks out.
            </p>
            <div className="reveal mt-8 flex flex-wrap gap-3">
              <Link href="/requests" className={ON_PHOTO_LIGHT}>
                See a live verification
              </Link>
              <Link href="/setup" className={ON_PHOTO_DARK}>
                Try it on your own vendor
              </Link>
            </div>
            <div className="reveal mt-8">
              <CallBar label={barLabel} />
            </div>
            </div>
            <div className="reveal">
              <LiveChecks
                checks={checks.map((c) => ({ key: c.key, label: c.label, t: c.t }))}
                audioStartMs={SHOWCASE_AUDIO_START_MS}
                amount={money(run.payment.amount_cents)}
                releasedTo={`${run.request.new_bank_name} ending ${run.request.new_account_last4}`}
              />
            </div>
          </div>
        </section>

        {/* Proof strip */}
        <section className="border-b border-line bg-panel">
          <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8">
            <p className="eyebrow text-subtle">A real verification run, {recordedOn}</p>
            <ol className="mt-6 grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
              {steps.map((s, i) => (
                <li key={s.label} className="border-line pr-4 lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0">
                  <p className="data text-[13px] text-subtle">{s.t === null ? "--:--" : clock(s.t)}</p>
                  <p className={`subheading mt-1 text-[17px] ${i >= 4 ? "text-pass" : "text-ink"}`}>{s.label}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why */}
        <section id="how" className="bg-canvas">
          <div className="mx-auto max-w-[1280px] px-4 pt-24 text-center sm:px-8 sm:pt-28">
            <p className="eyebrow text-ink">The call your team skips</p>
            <h2 className="heading mx-auto mt-4 max-w-[720px] text-[36px] text-ink sm:text-[48px]">The control exists. People skip it.</h2>
            <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-[1.5] text-muted">
              94% of companies say they call the vendor back on a number from official records. Only 63% say that control works well. Kovrell
              makes the call mandatory, runs it the same way every time, and records it.{" "}
              <a href={`${AFP_HIGHLIGHTS}#page=15`} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">
                AFP 2026, PDF p. 15
              </a>
            </p>
          </div>

          {/* Feature row 1: the request */}
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
            <div>
              <Mark size={28} />
              <h3 className="heading mt-5 text-[32px] text-ink sm:text-[40px]">Every bank change is held and checked first.</h3>
              <p className="mt-4 max-w-[440px] text-[16px] leading-[1.55] text-muted">
                An email asks to move {money(run.payment.amount_cents)} to a new bank. Kovrell holds the payment, ignores the callback number in the
                email, and checks that the number of record is old and unchanged before it dials.
              </p>
            </div>
            <ProductFrame image="/images/warm-bokeh.jpg">
              <div className="flex items-start justify-between gap-4 border-b border-line p-5">
                <div>
                  <p className="text-[17px]">{run.vendor.name}</p>
                  <p className="mt-0.5 text-[13px] text-muted">Bank change by email. Contact of record {run.vendor.contact_name}.</p>
                </div>
                <div className="text-right">
                  <p className="data text-[20px]">{money(run.payment.amount_cents)}</p>
                  <Stamp kind="HELD" />
                </div>
              </div>
              <div className="grid grid-cols-2 border-b border-line">
                <div className="border-r border-line p-5">
                  <p className="label text-subtle">On file</p>
                  <p className="mt-1.5 text-[14px]">
                    {run.on_file.bank_name} <span className="data">{run.on_file.account_last4}</span>
                  </p>
                </div>
                <div className="p-5">
                  <p className="label text-subtle">Requested</p>
                  <p className="mt-1.5 text-[14px]">
                    {run.request.new_bank_name} <span className="data">{run.request.new_account_last4}</span>
                  </p>
                </div>
              </div>
              <div className="p-5">
                {run.provenance?.map((p) => (
                  <div key={p.key} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
                    <span className="text-[14px]">
                      {p.label}
                      <span className="block text-[12px] text-muted">{p.detail}</span>
                    </span>
                    <span className={`label ${p.status === "ok" ? "text-pass" : "text-muted"}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </ProductFrame>
          </div>

          {/* Feature row 2: the call */}
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-10 px-4 pb-24 sm:px-8 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
            <div className="order-2 min-w-0 lg:order-1">
              <ProductFrame image="/images/forest-motion.jpg">
                <div className="flex items-center justify-between border-b border-line p-5">
                  <p className="text-[15px]">
                    Calling {run.vendor.contact_name} <span className="data text-muted">{run.vendor.contact_phone}</span>
                  </p>
                  <Stamp kind="VERIFIED" />
                </div>
                <div className="px-5 pt-4">
                  <RecordingWave levels={run.levels} height={44} />
                </div>
                <div className="p-5">
                  {checks.map((c) => (
                    <div key={c.key} className="grid grid-cols-[48px_1fr_auto] items-baseline gap-3 border-b border-line py-2.5 last:border-b-0">
                      <span className="data text-[12px] text-subtle">{clock(c.t)}</span>
                      <span className="text-[14px]">
                        {c.label}
                        {c.heard && <span className="data block text-[12px] text-muted">Heard: {c.heard}</span>}
                      </span>
                      <span className="label text-pass">{c.status}</span>
                    </div>
                  ))}
                </div>
              </ProductFrame>
            </div>
            <div className="order-1 min-w-0 lg:order-2">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="text-ink">
                <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2" />
              </svg>
              <h3 className="heading mt-5 text-[32px] text-ink sm:text-[40px]">It calls the number of record and checks the answers.</h3>
              <p className="mt-4 max-w-[440px] text-[16px] leading-[1.55] text-muted">
                Three questions from the ledger, one attempt each. The agent never says the answers and never says whether one was right. Fixed
                rules release the payment to {run.request.new_bank_name} ending {run.request.new_account_last4}.
              </p>
            </div>
          </div>
        </section>

        {/* Mint band */}
        <section className="bg-mint">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-8">
            <h2 className="subheading text-[22px] text-black sm:text-[26px]">Hear for yourself</h2>
            <BandPlay />
          </div>
        </section>

        {/* Evidence, dark */}
        <section id="evidence" className="border-t border-line bg-panel">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <p className="eyebrow text-ink">The evidence</p>
              <h2 className="heading mt-4 text-[36px] text-ink sm:text-[44px]">Every run leaves a sealed record.</h2>
              <p className="mt-4 max-w-[420px] text-[16px] leading-[1.55] text-muted">
                The recording, the transcript, every tool call, and the expected versus heard answers, sealed with sha256. Download this run and check
                the hash yourself.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={SHOWCASE_RECORD} download className={PRIMARY}>
                  Download the sealed record <Arrow />
                </a>
                <a href={`/api/runs/${run.run.id}/pdf`} download className={SECONDARY}>
                  Download the PDF report
                </a>
              </div>
              <div className="mt-8">
                <Seal hash={run.sha256} downloadHref={SHOWCASE_RECORD} />
              </div>
              <Link href={`/evidence/${run.run.id}`} className="mt-6 inline-block text-[15px] text-ink underline underline-offset-4">
                Open the full evidence pack
              </Link>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[10px] border border-line bg-canvas p-5 sm:row-span-2">
                <p className="label text-subtle">Transcript</p>
                <div className="mt-3 max-h-[420px] overflow-y-auto">
                  {lines.map((l, i) => (
                    <div key={i} className="border-t border-line py-2.5">
                      <p className="label text-subtle">
                        {clock(l.t)} <span className={l.who === "agent" ? "text-ink" : "text-muted"}>{l.who === "agent" ? "Agent" : "Vendor"}</span>
                      </p>
                      <p className={`mt-1 text-[14px] ${l.who === "agent" ? "text-ink" : "text-ink-2"}`}>{l.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[10px] border border-line bg-canvas p-5">
                <p className="label text-subtle">Expected vs heard</p>
                {checks
                  .filter((c) => c.expected)
                  .map((c) => (
                    <div key={c.key} className="mt-3 border-t border-line pt-3">
                      <p className="text-[14px]">{c.label}</p>
                      <p className="data mt-1 text-[12px] text-muted">
                        {/^\d+\.\d{2}$/.test(c.expected!) ? money(Math.round(Number(c.expected) * 100)) : c.expected} / {c.heard}
                      </p>
                    </div>
                  ))}
              </div>
              <div className="rounded-[10px] border border-line bg-canvas p-5">
                <p className="label text-subtle">Verdict</p>
                <div className="mt-3 flex items-center gap-3">
                  <Mark size={24} verified />
                  <Stamp kind="VERIFIED" />
                </div>
                <p className="mt-3 text-[14px] text-ink-2">
                  Released to {run.request.new_bank_name} ending {run.request.new_account_last4}.
                </p>
                <p className="mt-1 text-[13px] text-muted">{run.run.reason}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Controls grid */}
        <section className="bg-canvas">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="eyebrow text-ink">Built for audit</p>
              <h2 className="heading mt-4 text-[36px] text-ink sm:text-[40px]">Controls that hold up</h2>
              <p className="mt-3 text-[16px] text-muted">A callback control, run the same way on every change.</p>
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
                    className="mt-0.5 text-ink"
                  >
                    {c.icon}
                  </svg>
                  <div>
                    <p className="subheading text-[18px] text-ink">{c.title}</p>
                    <p className="mt-1.5 text-[15px] leading-[1.5] text-muted">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Integration */}
        <section className="border-t border-line bg-canvas">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="eyebrow text-ink">Integration</p>
              <h2 className="heading mt-4 text-[36px] text-ink sm:text-[40px]">Plugs into your payment run.</h2>
              <p className="mt-3 max-w-[360px] text-[16px] leading-[1.55] text-muted">
                Your ERP keeps the vendor master and the payment schedule. Kovrell holds the payment, makes the call, and tells your ERP what to do.
              </p>
              <Link href="/integrate" className="mt-6 inline-block text-[15px] text-ink underline underline-offset-4">
                How to integrate
              </Link>
            </div>
            <ol className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {INTEGRATION.map((step, i) => (
                <li key={step.title} className="border-t border-line pt-5">
                  <p className="data text-[13px] text-subtle">{String(i + 1).padStart(2, "0")}</p>
                  <p className="subheading mt-2 text-[18px] text-ink">{step.title}</p>
                  <p className="mt-1.5 text-[15px] leading-[1.5] text-muted">{step.body}</p>
                  <p className="data mt-3 text-[13px] text-ink-2">{step.code}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Built on */}
        <section className="border-t border-line bg-panel">
          <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="eyebrow text-ink">Built on</p>
              <h2 className="heading mt-4 text-[36px] text-ink sm:text-[40px]">Real infrastructure, end to end.</h2>
              <p className="mt-3 max-w-[360px] text-[16px] leading-[1.55] text-muted">
                Every verification call runs live through the AssemblyAI Voice Agent API. This showcase uses a scripted test vendor and sample ledger data.
              </p>
            </div>
            <div className="min-w-0">
              <a
                href="https://www.assemblyai.com/products/voice-agent-api"
                target="_blank"
                rel="noreferrer"
                className="block rounded-[10px] border border-line bg-canvas p-8 hover:border-line-strong"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tech/assemblyai.svg" alt="AssemblyAI" width={161} height={28} className="h-9 w-auto" />
                <p className="subheading mt-6 text-[22px] text-ink">Voice Agent API</p>
                <p className="mt-2 max-w-[640px] text-[15px] leading-[1.5] text-muted">
                  Universal-3.5 Pro speech-to-text, turn detection and barge-in, JSON Schema tool calls, the agent&apos;s voice, and the session
                  recording and timeline that seal each evidence pack.
                </p>
              </a>
            </div>
          </div>
        </section>

        {/* Numbers */}
        <section id="numbers" className="border-t border-line bg-panel">
          <div className="mx-auto max-w-[1280px] px-4 py-24 sm:px-8">
            <h2 className="heading text-center text-[36px] text-ink sm:text-[40px]">Payments fraud, by the numbers.</h2>
            <div className="mt-14 grid grid-cols-2 gap-y-10 lg:grid-cols-5">
              {STATS.map((s) => (
                <div key={s.n} className="border-line px-4 text-center lg:border-l lg:first:border-l-0">
                  <p className="display text-[48px] text-ink sm:text-[56px]">{s.n}</p>
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
                  <p className="display text-[48px] text-ink sm:text-[56px]">{(run.median_response_ms / 1000).toFixed(1)}s</p>
                  <p className="mx-auto mt-2 max-w-[220px] text-[14px] leading-[1.45] text-muted">from the vendor finishing a sentence to the agent speaking</p>
                  <p className="label mt-3 text-subtle">Measured on this run</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Close */}
        <section className="relative isolate overflow-hidden">
          <Image src="/images/forest-motion.jpg" alt="" fill sizes="100vw" className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-black/45" />
          <div className="mx-auto max-w-[1280px] px-4 py-28 sm:px-8">
            <h2 className="display max-w-[720px] text-[44px] text-white sm:text-[64px]">Verify the vendor before you release the payment.</h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/requests" className={ON_PHOTO_LIGHT}>
                See a live verification
              </Link>
              <Link href="/setup" className={ON_PHOTO_DARK}>
                Try it on your own vendor
              </Link>
              <Link href="/integrate" className={ON_PHOTO_DARK}>
                How to integrate
              </Link>
              <a href={PILOT_MAILTO} className={ON_PHOTO_DARK}>
                Request a pilot
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-line bg-canvas">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-start justify-between gap-10 px-4 py-14 sm:px-8">
            <Wordmark />
            <div className="grid grid-cols-2 gap-x-16">
              <div className="flex flex-col gap-2">
                <p className="label text-pass">Product</p>
                <Link href="/requests" className="text-[14px] text-muted hover:text-ink">
                  Requests
                </Link>
                <Link href="/setup" className="text-[14px] text-muted hover:text-ink">
                  Set up
                </Link>
                <Link href="/vendors" className="text-[14px] text-muted hover:text-ink">
                  Vendors
                </Link>
                <Link href="/evidence" className="text-[14px] text-muted hover:text-ink">
                  Runs
                </Link>
                <a href={SHOWCASE_RECORD} download className="text-[14px] text-muted hover:text-ink">
                  Sealed record
                </a>
              </div>
              <div className="flex flex-col gap-2">
                <p className="label text-pass">Proof</p>
                <ScrollLink to="evidence" className="text-[14px] text-muted hover:text-ink">
                  Evidence
                </ScrollLink>
                <ScrollLink to="numbers" className="text-[14px] text-muted hover:text-ink">
                  Numbers
                </ScrollLink>
                <Link href="/integrate" className="text-[14px] text-muted hover:text-ink">
                  Integrate
                </Link>
                <Link href="/privacy" className="text-[14px] text-muted hover:text-ink">
                  Calls and recordings
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ShowcasePlayer>
  );
}
