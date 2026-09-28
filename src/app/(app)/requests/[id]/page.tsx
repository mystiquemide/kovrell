import Link from "next/link";
import { notFound } from "next/navigation";
import { Stamp, requestStamp, verdictStamp } from "@/components/stamp";
import { CHANNEL_LABEL, dateOnly, dateTime, duration, money } from "@/lib/format";
import { getStore } from "@/server/store";
import { requestView } from "@/server/views";
import { CallButton } from "@/components/call-button";
import { InPersonForm } from "./in-person-form";
import { COPY } from "@/lib/messages";
import { defaultCompany, visitorCompany } from "@/lib/company";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const PROVENANCE_RESULT = { ok: "text-pass", fail: "text-fail", info: "text-muted" } as const;

export async function generateMetadata({ params }: PageProps<"/requests/[id]">): Promise<Metadata> {
  const { id } = await params;
  const vendor = getStore().getRequestDetail(id)?.vendor.name;
  return { title: vendor ? `${vendor} bank change` : "Request" };
}

export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const { id } = await params;
  const view = requestView(getStore(), id);
  if (!view) notFound();
  const { request, vendor, payment, preflight, questionPool, webhook, runs, openRunId, dueInDays: due } = view;
  const locked = request.status === "held" && preflight.locked;
  const caller = vendor.payer_name || (await visitorCompany()) || defaultCompany();
  const decided = request.status !== "held";
  const clear = preflight.checks.filter((c) => c.status !== "fail").length;

  return (
    <div className="reveal">
      <Link href="/requests" className="label text-subtle hover:text-ink">
        &larr; Requests
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="heading text-[32px] sm:text-[40px]">{vendor.name}</h1>
          <p className="mt-2 text-muted">
            Bank change received by {CHANNEL_LABEL[request.channel]?.toLowerCase() ?? request.channel}, {dateTime(request.received_at)}.{" "}
            {due > 0 ? `Payment due in ${due} day${due === 1 ? "" : "s"}.` : due === 0 ? "Payment due today." : "Payment overdue."}
          </p>
        </div>
        <Stamp kind={requestStamp(request.status, locked)} large />
      </div>

      <section className="mt-10 border-t border-line pt-8">
        <p className="data text-[32px] leading-tight">{money(payment.amount_cents)}</p>
        <p className="label mt-2 text-subtle">
          {payment.status === "released"
            ? `Released to account ending ${payment.destination_last4}`
            : payment.status === "blocked"
              ? `Blocked. Account on file kept, ending ${payment.destination_last4}`
              : "Held until verified"}
        </p>
      </section>

      <section className="mt-10 grid gap-px overflow-hidden rounded-[5.6px] border border-line bg-line sm:grid-cols-2">
        <div className="bg-panel p-6">
          <p className="label text-subtle">On file</p>
          <p className="mt-3 text-[18px]">{vendor.bank_name}</p>
          <p className="mt-1 text-muted">
            Account ending <span className="data text-ink">{vendor.account_last4}</span>
          </p>
        </div>
        <div className="bg-panel p-6">
          <p className="label text-subtle">Requested</p>
          <p className="mt-3 text-[18px]">{request.new_bank_name}</p>
          <p className="mt-1 text-muted">
            Account ending <span className="data text-ink">{request.new_account_last4}</span>
          </p>
        </div>
      </section>

      <section className="mt-10">
        <p className="label text-subtle">Callback contact in the request</p>
        <p className="mt-3 text-muted">
          {request.callback_contact ? (
            <>
              <span className="data text-ink">{request.callback_contact}</span>
              <span className="label ml-3 text-fail">Not used</span>
              <span className="mt-1 block text-[14px]">Kovrell only calls the contact of record.</span>
            </>
          ) : (
            "The request gave no callback contact. Kovrell only calls the contact of record."
          )}
        </p>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <p className="label text-subtle">Provenance</p>
          <p className={`label ${locked ? "text-fail" : "text-muted"}`}>
            {clear} of {preflight.checks.length} clear
          </p>
        </div>
        <div className="mt-3">
          {preflight.checks.map((c) => (
            <div key={c.key} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line py-4">
              <div>
                <p>{c.label}</p>
                <p className="mt-0.5 text-[14px] text-muted">{c.detail}</p>
              </div>
              <span className={`label ${PROVENANCE_RESULT[c.status]}`}>{c.status}</span>
            </div>
          ))}
        </div>
      </section>

      {questionPool.length > 0 && (
        <section className="mt-10">
          <p className="label text-subtle">Ledger questions</p>
          <p className="mt-3 text-muted">
            Two invoice totals and one payment date, drawn at random for each call from {questionPool.join(", ")}.
          </p>
          <p className="mt-1 text-[14px] text-subtle">Answers are never spoken on the call. One attempt each.</p>
        </section>
      )}

      {webhook && (
        <section className="mt-10">
          <p className="label text-subtle">Webhook</p>
          <p className="mt-3 text-muted">
            {webhook.delivered
              ? `Verdict posted to ${webhook.host}, HTTP ${webhook.last_code}, ${dateTime(webhook.last_at!)}.`
              : webhook.attempts === 0
                ? `The verdict will be posted to ${webhook.host} when the call ends, signed with this request's secret.`
                : `Posting to ${webhook.host} failed after ${webhook.attempts} ${webhook.attempts === 1 ? "try" : "tries"}: ${webhook.last_error}.`}
          </p>
        </section>
      )}

      <section className="mt-12 border-t border-line pt-8">
        {decided ? (
          <div className="flex flex-wrap items-center gap-4">
            <p className={request.status === "verified" ? "text-pass" : "text-fail"}>
              {request.status === "verified"
                ? `Verified. Payment released to ${request.new_bank_name} ending ${request.new_account_last4}.`
                : "Blocked. The payment stays on the account on file."}
            </p>
            {runs[0] && (
              <Link href={`/evidence/${runs[0].id}`} className="label text-ink underline-offset-4 hover:underline">
                Evidence pack &rarr;
              </Link>
            )}
          </div>
        ) : openRunId ? (
          <Link href={`/calls/${openRunId}`} className="label text-ink underline-offset-4 hover:underline">
            A verification call is in progress. Open it &rarr;
          </Link>
        ) : (
          <CallButton
            requestId={request.id}
            contactName={vendor.contact_name}
            disabledReason={locked ? (preflight.reason ?? COPY.locked) : null}
          />
        )}
      </section>

      {request.status === "held" && !openRunId && (locked || runs[0]?.verdict === "INCONCLUSIVE") && (
        <InPersonForm requestId={request.id} reason={locked ? "locked" : "inconclusive"} />
      )}

      {runs.length > 0 && (
        <section className="mt-14">
          <p className="label text-subtle">Verification runs</p>
          <div className="mt-3">
            {runs.map((r) => (
              <Link
                key={r.id}
                href={r.status === "ended" ? `/evidence/${r.id}` : `/calls/${r.id}`}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line py-4 hover:bg-panel"
              >
                <span className="data text-[14px] text-muted">{r.id}</span>
                <span className="data text-[14px] text-muted">{dateTime(r.started_at)}</span>
                <span className="data text-[14px] text-subtle">{duration(r.started_at, r.ended_at) ?? ""}</span>
                <Stamp kind={verdictStamp(r.verdict, r.status)} />
                <span className="text-[14px] text-muted">{r.reason ?? (r.status === "ringing" ? "Waiting for the vendor to answer." : "")}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-14 text-[14px] text-subtle">
        Contact of record: {vendor.contact_name}, <span className="data">{vendor.contact_phone}</span>.{" "}
        Calls on behalf of {caller}. 
        <Link href={`/vendors/${vendor.id}`} className="underline-offset-4 hover:text-ink hover:underline">
          Vendor record
        </Link>
        . Payment scheduled {dateOnly(payment.due_on)}.
      </p>
    </div>
  );
}
