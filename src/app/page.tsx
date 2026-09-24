import Image from "next/image";
import Link from "next/link";
import { Arrow, ButtonLink } from "@/components/button";
import { Wordmark } from "@/components/mark";
import { getStore } from "@/server/store";
import { HearCall } from "./_landing/hear-call";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Held", "A bank-detail change arrives. The payment is held."],
  ["Provenance", "Kovrell checks the number of record. A recently changed number locks the call."],
  ["Call", "The agent calls the contact of record, never the number in the request."],
  ["Challenge", "Three questions from the ledger. One attempt each. The answers are never spoken."],
  ["Verdict", "Fixed rules decide. A pass releases, a fail blocks, anything else keeps the payment held."],
  ["Evidence", "Recording, transcript, tool calls, and checks, sealed with sha256."],
];

export default function Landing() {
  const store = getStore();
  const recorded = store.latestRecordedRun();
  const responseMs = store.measuredResponseMs();

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate overflow-hidden border-b border-iron">
        <Image
          src="/images/green-texture.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-void/70" />
        <header className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <ButtonLink href="/requests" variant="secondary">
            Open requests <Arrow />
          </ButtonLink>
        </header>

        <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-24 sm:px-6 sm:pt-32">
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
            <HearCall runId={recorded?.run_id ?? null} levels={recorded?.levels ?? []} />
          </div>
        </div>
      </section>

      <section className="border-b border-iron">
        <div className="mx-auto grid max-w-[1200px] md:grid-cols-2">
          <div className="relative min-h-[320px] md:min-h-[480px]">
            <Image src="/images/rotary-phone.jpg" alt="A black rotary telephone on a desk" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
          <div className="flex flex-col justify-center px-4 py-16 sm:px-12">
            <p className="label text-zinc">The call your team skips</p>
            <h2 className="heading mt-4 text-[32px] sm:text-[40px]">The control exists. People skip it.</h2>
            <p className="mt-5 text-[18px] leading-[1.5] text-mercury">
              91% of companies already have callback controls. Fraud still gets through when a busy team skips the call, or
              confirms on the same email thread the fraudster wrote from. Kovrell makes the call every time and keeps the proof.
            </p>
            <p className="label mt-6 text-zinc">Source: AFP 2026 Payments Fraud and Control Survey</p>
          </div>
        </div>
      </section>

      <section className="border-b border-iron">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
          <h2 className="heading text-[32px] sm:text-[40px]">How a verification run works</h2>
          <div className="mt-10">
            {STEPS.map(([title, body], i) => (
              <div key={title} className="grid grid-cols-[40px_1fr] gap-4 border-t border-iron py-5 sm:grid-cols-[64px_200px_1fr]">
                <span className="data text-[14px] text-zinc">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[18px]">{title}</span>
                <span className="col-start-2 text-mercury sm:col-start-3">{body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-iron">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
          <h2 className="heading text-[32px] sm:text-[40px]">By the numbers</h2>
          <div className="mt-10">
            {[
              ["76%", "of US organizations were hit by attempted or actual payments fraud in 2025", "AFP 2026"],
              ["60%", "cite vendor impersonation", "AFP 2026"],
              ["91%", "already have callback verification", "AFP 2026"],
              ...(responseMs !== null ? [[`${(responseMs / 1000).toFixed(1)} s`, "median time from the vendor finishing a sentence to the agent speaking, on Kovrell calls", "Measured"]] : []),
            ].map(([n, text, source]) => (
              <div key={text} className="grid grid-cols-1 gap-2 border-t border-iron py-6 sm:grid-cols-[200px_1fr_140px] sm:items-baseline">
                <span className="data text-[32px] leading-none">{n}</span>
                <span className="text-[18px] text-bone">{text}</span>
                <span className="label text-zinc sm:text-right">{source}</span>
              </div>
            ))}
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
