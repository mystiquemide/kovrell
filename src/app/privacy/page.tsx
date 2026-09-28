import Link from "next/link";
import { Wordmark } from "@/components/mark";

export const metadata = { title: "Calls and recordings" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Who calls",
    body: [
      "The accounts payable team of a company that pays you, through Kovrell. The call goes only to the contact that company already has on file for you, never to a number taken from a request.",
      "The call is automated. The agent says so, and says that the call is recorded, before it asks anything.",
    ],
  },
  {
    title: "Why",
    body: [
      "Someone asked that company to change the bank account it pays you. Before any money moves, Kovrell checks with you that the request is real.",
    ],
  },
  {
    title: "What the call asks",
    body: [
      "Who you are, whether your team asked for the change, a few details only your company would know from past invoices and payments, and a readback of the new account ending.",
      "The call never asks for passwords or card numbers.",
    ],
  },
  {
    title: "What's recorded",
    body: [
      "Both sides of the call, the transcript, the answers heard, and the result. Kovrell seals these into an evidence record for the paying company's auditors.",
    ],
  },
  {
    title: "Where it's kept",
    body: [
      "The voice session runs on the AssemblyAI Voice Agent API, which keeps the call recording and timeline with that session until it's deleted. Kovrell keeps the evidence record on its own server.",
      "In this sandbox, resetting the sample ledger deletes Kovrell's records and asks AssemblyAI to delete the recording of every call it removes. One showcase call, spoken by a scripted test caller, is kept as a public example.",
      "In production, the paying company decides how long evidence is kept, to match its audit rules.",
    ],
  },
  {
    title: "Questions",
    body: ["Contact the company that called you. For this sandbox, write to splashmediahub@gmail.com."],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-8">
      <Link href="/" aria-label="Kovrell home">
        <Wordmark />
      </Link>
      <p className="label mt-14 text-subtle">Calls and recordings</p>
      <h1 className="heading mt-3 text-[32px] sm:text-[40px]">What happens when Kovrell calls you.</h1>
      <p className="mt-4 text-[17px] leading-[1.55] text-muted">If you got a payment verification call from Kovrell, this is what it was for and what was kept.</p>
      <div className="mt-10 border-t border-line">
        {SECTIONS.map((s) => (
          <section key={s.title} className="border-b border-line py-7">
            <h2 className="subheading text-[20px] text-ink">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-2 text-[16px] leading-[1.6] text-ink-2">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
