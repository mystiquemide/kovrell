import Image from "next/image";
import Link from "next/link";
import { Arrow, ButtonLink, SECONDARY } from "@/components/button";
import { Mark, Wordmark } from "@/components/mark";
import { Stamp } from "@/components/stamp";
import { clock, dateOnly, money } from "@/lib/format";
import { SHOWCASE_AUDIO, SHOWCASE_RECORD, callLengthMs, checkTimeline, milestones, showcase, transcript } from "@/showcase";
import { HearCall } from "./_landing/hear-call";

const AFP_RELEASE =
  "https://www.financialprofessionals.org/about/learn-more/press-releases/Details/over-75-percent-of-us-firms-experienced-payments-fraud-in-2025-while-ai-adoption-for-fraud-mitigation-lags";
const AFP_HIGHLIGHTS =
  "https://www.truist.com/content/dam/truist-bank/us/en/documents/info/cci/2026-afp-payments-fraud-control-survey-report-key-highlights.pdf";

const STATS = [
  {
    n: "76%",
    text: "of US organizations faced attempted or actual payments fraud in 2025.",
    source: "AFP 2026 press release",
    href: AFP_RELEASE,
  },
  {
    n: "74%",
    text: "were hit by business email compromise. Fraudsters primarily impersonate vendors or executives to change payment instructions.",
    source: "AFP 2026 highlights, PDF p. 6",
    href: `${AFP_HIGHLIGHTS}#page=6`,
  },
  {
    n: "94%",
    text: "say they call an authorized contact on a number from official records before moving money. Only 63% call that control very effective.",
    source: "AFP 2026 highlights, PDF p. 15",
    href: `${AFP_HIGHLIGHTS}#page=15`,
  },
  {
    n: "17%",
    text: "use AI to fight payments fraud.",
    source: "AFP 2026 press release",
    href: AFP_RELEASE,
  },
];

export default function Landing() {
  const run = showcase;
  const steps = milestones();
  const checks = checkTimeline();
  const lines = transcript();
  const recordedOn = dateOnly(run.recorded_at);
  const caption = `Recorded Kovrell run, ${recordedOn}. Northwind Steel, ${clock(callLengthMs())} call, verified. Vendor answers spoken by a scripted test caller.`;

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-iron">
        <Image src="/images/green-texture.jpg" alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-void/70" />
        <header className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <ButtonLink href="/requests" variant="secondary">
            <span className="sm:hidden">See it live</span>
            <span className="hidden sm:inline">See a live verification</span> <Arrow />
          </ButtonLink>
        </header>
        <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-20 sm:px-6 sm:pt-28">
          <p className="label reveal text-mercury">Voice verification for vendor payments</p>
          <h1 className="display reveal mt-6 max-w-4xl text-[44px] sm:text-[68px]">
            Kovrell calls the vendor
            <br />
            before you pay.
          </h1>
          <p className="reveal mt-6 max-w-2xl text-[18px] leading-[1.5] text-bone">
            A voice agent verifies every bank-detail change on the vendor&apos;s number of record, asks what only the real vendor
            knows, and holds the payment until it checks out.
          </p>
          <div className="reveal mt-10">
            <HearCall src={SHOWCASE_AUDIO} levels={run.levels} caption={caption} />
          </div>
        </div>
      </section>

      {/* Proof strip: real milestones from the recorded run */}
      <section className="border-b border-iron bg-carbon">
        <ol className="mx-auto grid max-w-[1200px] grid-cols-2 px-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
          {steps.map((s, i) => (
            <li key={s.label} className="border-iron py-5 pr-4 lg:border-l lg:pl-4 lg:first:border-l-0 lg:first:pl-0">
              <p className="data text-[13px] text-zinc">{s.t === null ? "--:--" : clock(s.t)}</p>
              <p className={`label mt-1 ${i >= 4 ? "text-mint" : "text-cream"}`}>{s.label}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why */}
      <section className="border-b border-iron">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[5.6px]">
            <Image src="/images/rotary-phone.jpg" alt="A black rotary telephone on a desk" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
          </div>
          <div>
            <p className="label text-zinc">The call your team skips</p>
            <h2 className="heading mt-4 text-[32px] sm:text-[40px]">The control exists. People skip it.</h2>
            <p className="mt-5 text-[18px] leading-[1.5] text-mercury">
              94% of companies say they call the vendor back on a number from official records. Only 63% say that control works
              well. The gap is execution: a busy team skips the call, or confirms on the same email thread the fraudster wrote
              from.
            </p>
            <p className="mt-4 text-[18px] leading-[1.5] text-bone">Kovrell makes the call mandatory, runs it the same way every time, and records it.</p>
            <a href={`${AFP_HIGHLIGHTS}#page=15`} target="_blank" rel="noreferrer" className="label mt-6 inline-block text-zinc underline-offset-4 hover:text-cream hover:underline">
              Source: AFP 2026 Payments Fraud and Control Survey, PDF p. 15
            </a>
          </div>
        </div>
      </section>

      {/* The request */}
      <section className="border-b border-iron">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
          <p className="label text-zinc">A real verification run</p>
          <h2 className="heading mt-4 text-[32px] sm:text-[40px]">An email asks to move $184,200 to a new bank.</h2>
          <div className="mt-10 rounded-[5.6px] border border-iron bg-carbon">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-iron p-6">
              <div>
                <p className="text-[20px]">{run.vendor.name}</p>
                <p className="mt-1 text-[14px] text-mercury">Bank change received by email. Contact of record {run.vendor.contact_name}.</p>
              </div>
              <div className="text-right">
                <p className="data text-[24px]">{money(run.payment.amount_cents)}</p>
                <p className="label mt-1 text-zinc">Held until verified</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2">
              <div className="border-b border-iron p-6 sm:border-r">
                <p className="label text-zinc">On file</p>
                <p className="mt-2">
                  {run.on_file.bank_name}, ending <span className="data">{run.on_file.account_last4}</span>
                </p>
              </div>
              <div className="border-b border-iron p-6">
                <p className="label text-zinc">Requested</p>
                <p className="mt-2">
                  {run.request.new_bank_name}, ending <span className="data">{run.request.new_account_last4}</span>
                </p>
              </div>
            </div>
            <div className="p-6">
              <p className="label text-zinc">Before calling</p>
              {run.provenance?.map((p) => (
                <div key={p.key} className="flex flex-wrap items-baseline justify-between gap-x-6 border-t border-iron py-3 first-of-type:mt-3">
                  <span>
                    {p.label}
                    <span className="ml-3 text-[14px] text-mercury">{p.detail}</span>
                  </span>
                  <span className={`label ${p.status === "ok" ? "text-mint" : p.status === "fail" ? "text-ember" : "text-mercury"}`}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The run, step by step */}
      <section className="border-b border-iron">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
          <p className="label text-zinc">The call</p>
          <h2 className="heading mt-4 text-[32px] sm:text-[40px]">Kovrell calls the number of record and checks the answers.</h2>
          <p className="mt-4 max-w-2xl text-mercury">
            Three questions from the ledger. One attempt each. The agent never says the answers and never says whether one was right.
            Fixed rules decide the verdict.
          </p>
          <div className="mt-10">
            {checks.map((c) => (
              <div key={c.key} className="grid grid-cols-[56px_1fr_auto] items-baseline gap-x-4 gap-y-1 border-t border-iron py-4 sm:grid-cols-[72px_240px_1fr_auto]">
                <span className="data text-[13px] text-zinc">{clock(c.t)}</span>
                <span>{c.label}</span>
                <span className="data col-start-2 text-[14px] text-mercury sm:col-start-3">
                  {c.heard ? `Heard: ${c.heard}` : ""}
                </span>
                <span className="label col-start-3 row-start-1 text-mint sm:col-start-4">{c.status}</span>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-iron py-6">
              <span className="flex items-center gap-3">
                <Mark size={24} verified />
                <span className="text-[18px]">
                  Released to {run.request.new_bank_name} ending <span className="data">{run.request.new_account_last4}</span>.
                </span>
              </span>
              <Stamp kind="VERIFIED" large />
            </div>
          </div>
        </div>
      </section>

      {/* Evidence */}
      <section className="border-b border-iron">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
          <p className="label text-zinc">The evidence</p>
          <h2 className="heading mt-4 text-[32px] sm:text-[40px]">Every run leaves a sealed record.</h2>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-[5.6px] border border-iron bg-carbon p-6">
              <p className="label text-zinc">Transcript</p>
              <div className="mt-3 max-h-[360px] overflow-y-auto">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[48px_60px_1fr] gap-3 border-t border-iron/70 py-2.5">
                    <span className="data text-[12px] text-zinc">{clock(l.t)}</span>
                    <span className={`label ${l.who === "agent" ? "text-cream" : "text-mercury"}`}>{l.who === "agent" ? "Agent" : "Vendor"}</span>
                    <span className={`text-[15px] ${l.who === "agent" ? "text-cream" : "text-bone"}`}>{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-8">
              <div className="rounded-[5.6px] border border-iron bg-carbon p-6">
                <p className="label text-zinc">Expected vs heard</p>
                {checks
                  .filter((c) => c.expected)
                  .map((c) => (
                    <div key={c.key} className="mt-3 border-t border-iron pt-3">
                      <p className="text-[15px]">{c.label}</p>
                      <p className="data mt-1 text-[13px] text-mercury">
                        Expected {/^\d+\.\d{2}$/.test(c.expected!) ? money(Math.round(Number(c.expected) * 100)) : c.expected}. Heard {c.heard}.
                      </p>
                    </div>
                  ))}
                <p className="mt-4 text-[13px] text-zinc">Expected values stay on the server. The agent never hears them.</p>
              </div>
              <div className="rounded-[5.6px] border border-iron bg-carbon p-6">
                <p className="label text-zinc">Seal</p>
                <p className="data mt-3 break-all text-[13px]">sha256 {run.sha256}</p>
                <p className="mt-2 text-[14px] text-mercury">
                  Over the canonical record: request, provenance, checks with expected values, every event, and the AssemblyAI session.
                </p>
                <a href={SHOWCASE_RECORD} download className={`${SECONDARY} mt-5`}>
                  Download the sealed record
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="border-b border-iron">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <h2 className="heading text-[32px] sm:text-[40px]">By the numbers</h2>
          <div className="mt-8">
            {STATS.map((s) => (
              <div key={s.n} className="grid grid-cols-1 gap-2 border-t border-iron py-5 sm:grid-cols-[120px_1fr_220px] sm:items-baseline">
                <span className="data text-[32px] leading-none">{s.n}</span>
                <span className="text-[17px] text-bone">{s.text}</span>
                <a href={s.href} target="_blank" rel="noreferrer" className="label text-zinc underline-offset-4 hover:text-cream hover:underline sm:text-right">
                  {s.source}
                </a>
              </div>
            ))}
            {run.median_response_ms !== null && (
              <div className="grid grid-cols-1 gap-2 border-t border-iron py-5 sm:grid-cols-[120px_1fr_220px] sm:items-baseline">
                <span className="data text-[32px] leading-none">{(run.median_response_ms / 1000).toFixed(1)} s</span>
                <span className="text-[17px] text-bone">median time from the vendor finishing a sentence to the agent speaking, on the recorded run.</span>
                <span className="label text-zinc sm:text-right">Measured by Kovrell</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="relative isolate overflow-hidden border-b border-iron">
        <Image src="/images/green-texture.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-void/80" />
        <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
          <h2 className="display max-w-3xl text-[40px] sm:text-[56px]">Verify the vendor before you release the payment.</h2>
          <p className="mt-5 max-w-xl text-[18px] text-bone">
            Open the inbox, start a verification run, and answer the vendor line yourself. The verdict and the sealed record are yours to
            inspect.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/requests">
              See a live verification <Arrow />
            </ButtonLink>
            <Link href="#hear" className={SECONDARY}>
              Hear the recorded call
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-6 px-4 py-10 sm:px-6">
        <Wordmark />
        <nav className="flex gap-6">
          {[
            ["/requests", "Requests"],
            ["/vendors", "Vendors"],
            ["/evidence", "Evidence"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="label text-zinc hover:text-cream">
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-[14px] text-zinc">Built on the AssemblyAI Voice Agent API.</p>
      </footer>
    </div>
  );
}
