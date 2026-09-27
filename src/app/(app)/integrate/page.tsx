import Link from "next/link";
import { Arrow, ButtonLink } from "@/components/button";

export const metadata = { title: "Integrate" };

const BASE = "https://kovrell.midelabs.xyz";

const STEPS = [
  {
    n: "00",
    title: "Sync the vendor and its paid invoices",
    body: "Your ERP sends the vendor master record: the contact of record, the bank on file, and recent paid invoices. The ledger questions are drawn from these invoices. You can also do this by hand on the Set up page.",
    code: `curl -X POST ${BASE}/api/vendors \\
  -H "content-type: application/json" \\
  -d '{"name":"Pine Ridge Lumber","contact_name":"Alex Morgan",
       "contact_phone":"+1 503 555 0164","bank_name":"U.S. Bank",
       "account_last4":"3907","number_on_file_days":540,
       "invoices":[{"number":"PRL-1182","amount_cents":1824000,"paid_on":"2026-07-25"},
                   {"number":"PRL-1207","amount_cents":2291550,"paid_on":"2026-08-23"}],
       "payment_amount_cents":3140000}'`,
  },
  {
    n: "01",
    title: "Send bank-detail changes to Kovrell",
    body: "When your AP inbox, vendor portal, or ERP sees a request to change a vendor's bank details, post it. Kovrell holds the vendor's next payment.",
    code: `curl -X POST ${BASE}/api/requests \\
  -H "content-type: application/json" \\
  -d '{"vendor_id":"v_halden","channel":"email",
       "new_bank_name":"Metro Commerce Bank",
       "new_account_last4":"7712",
       "callback_contact":"+1 646 555 0173",
       "webhook_url":"https://erp.example.com/kovrell"}'
# 201 returns the request and, with a webhook, its signing secret (shown once)`,
  },
  {
    n: "02",
    title: "Start a verification run",
    body: "Kovrell checks provenance first. If the number of record is new or recently changed, it refuses with 423 and a reason. Otherwise it rings the contact of record.",
    code: `curl -X POST ${BASE}/api/requests/req_halden/runs`,
  },
  {
    n: "03",
    title: "Get the verdict",
    body: "Kovrell posts verification.completed to your webhook when the call ends: verdict, payment status, and evidence links. Check the kovrell-signature header (HMAC-SHA256 of \"<t>.<body>\" with your secret) before acting on it. You can also poll the run or watch it live.",
    code: `# kovrell-signature: t=1790540000,v1=<hex>
expected = hmac_sha256(secret, f"{t}.{raw_body}")
curl ${BASE}/api/runs/<run id>
# live events: wss://kovrell.midelabs.xyz/ws/watch/<run id>`,
  },
  {
    n: "04",
    title: "Keep the evidence",
    body: "Every run ends with a sealed record: recording, transcript, tool calls, expected versus heard answers, and a sha256 over all of it. The PDF report is the readable copy an auditor files.",
    code: `curl -o record.json "${BASE}/api/runs/<run id>/evidence?download=1"
curl -o report.pdf "${BASE}/api/runs/<run id>/pdf"   # the same pack as a PDF for the audit file`,
  },
];

export default function IntegratePage() {
  return (
    <div className="reveal max-w-[880px]">
      <p className="label text-subtle">Integrate</p>
      <h1 className="heading mt-3 text-[32px] sm:text-[40px]">Put Kovrell in front of your payment run.</h1>
      <p className="mt-4 text-[17px] leading-[1.55] text-muted">
        Kovrell sits between a bank-detail change and the payment it affects. Five HTTP calls connect it to whatever sees those changes today. These
        examples run against this sandbox and its sample ledger.
      </p>
      <p className="mt-4 rounded-[10px] border border-line bg-panel px-4 py-3 text-[14px] text-ink-2">
        Sandbox requests use sample data and can be reset at any time. Don&apos;t send production vendor or banking information.
      </p>

      <div className="mt-12 border-t border-line">
        {STEPS.map((s) => (
          <section key={s.n} className="grid gap-4 border-b border-line py-8 sm:grid-cols-[64px_1fr]">
            <span className="data text-[14px] text-subtle">{s.n}</span>
            <div className="min-w-0">
              <h2 className="subheading text-[20px] text-ink">{s.title}</h2>
              <p className="mt-2 text-[15px] leading-[1.55] text-muted">{s.body}</p>
              <pre className="data mt-4 overflow-x-auto rounded-[10px] border border-line bg-panel p-4 text-[13px] leading-[1.6] text-ink">{s.code}</pre>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-[12px] border border-line bg-panel p-6">
        <h2 className="subheading text-[18px] text-ink">Where it runs</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-[1.55] text-muted">
          <li>The agent runs on the AssemblyAI Voice Agent API, held by the Kovrell server. The vendor&apos;s device only carries audio.</li>
          <li>The agent never receives expected answers. Checks and the verdict run in Kovrell&apos;s code, not in the model.</li>
          <li>Today the vendor answers on a secure call link. The same interface carries a phone line to the number of record.</li>
          <li>The ledger here is a sample. In production this is your vendor master and payment schedule.</li>
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/requests">
          Try a verification <Arrow />
        </ButtonLink>
        <Link href="/evidence" className="inline-flex h-10 items-center px-2 text-[15px] text-ink underline underline-offset-4">
          See sealed evidence
        </Link>
        <a
          href="mailto:splashmediahub@gmail.com?subject=Kovrell%20pilot%20request"
          className="inline-flex h-10 items-center px-2 text-[15px] text-ink underline underline-offset-4"
        >
          Request a pilot
        </a>
      </div>
    </div>
  );
}
