import type { Run, StoredCheck, Store } from "./store";
import { buildChallenges } from "./verification/challenges";
import { preflight, PROVENANCE_WINDOW_DAYS } from "./verification/provenance";

/** Checks as the AP team sees them. Expected ledger values stay out; they belong to the evidence pack. */
export function publicChecks(checks: StoredCheck[]) {
  return checks.map(({ key, status, heard }) => ({ key, status, heard }));
}

export function publicRun(run: Run) {
  // The call token is a bearer secret for the vendor. It never goes back out after creation.
  const rest: Partial<Run> = { ...run };
  delete rest.call_token;
  return rest as Omit<Run, "call_token">;
}

/** Human labels for every check key on a run, including the per-request ledger questions. */
export function checkLabels(detail: NonNullable<ReturnType<Store["getRequestDetail"]>>): Record<string, string> {
  const labels: Record<string, string> = {
    identity: "Identity",
    requested: "Vendor confirms the request",
    readback: "Readback of new account",
  };
  try {
    for (const c of buildChallenges(detail)) labels[c.id] = c.label;
  } catch {
    // Vendors without enough paid invoices cannot be called, so there are no question labels.
  }
  return labels;
}

export function vendorView(store: Store, id: string, now = Date.now()) {
  const data = store.getVendor(id);
  if (!data) return null;
  return {
    vendor: data.vendor,
    changes: data.changes.map((c) => ({
      ...c,
      recent: c.old_value !== null && now - Date.parse(c.changed_at) < PROVENANCE_WINDOW_DAYS * 86_400_000,
    })),
  };
}

export function inboxView(store: Store, now = Date.now()) {
  return store.listInbox().map((row) => {
    const detail = store.getRequestDetail(row.id)!;
    return { ...row, locked: row.status === "held" && preflight(detail, now).locked };
  });
}

export function runListView(store: Store) {
  return store.listRuns().map((r) => {
    const { call_token: _t, ...rest } = r;
    void _t;
    const ev = store.getEvidence(r.id);
    return { ...rest, evidence_status: ev?.status ?? null, sha256: ev?.sha256 ?? null };
  });
}

export function evidenceView(store: Store, id: string) {
  const run = store.getRun(id);
  if (!run) return null;
  const ev = store.getEvidence(id);
  const detail = store.getRequestDetail(run.request_id)!;
  return {
    run: publicRun(run),
    vendor: { id: detail.vendor.id, name: detail.vendor.name, contact_name: detail.vendor.contact_name, contact_phone: detail.vendor.contact_phone },
    labels: checkLabels(detail),
    request: detail.request,
    payment: detail.payment,
    // Expected ledger values are shown here only, for auditors.
    checks: store.listChecks(id),
    events: store.listEvents(id),
    evidence: ev
      ? {
          status: ev.status,
          sha256: ev.sha256,
          levels: ev.levels,
          audio_available: ev.audio_available,
          median_response_ms: ev.median_response_ms,
          updated_at: ev.updated_at,
        }
      : null,
    record: ev?.record ?? null,
  };
}

export function requestView(store: Store, id: string, now = Date.now()) {
  const detail = store.getRequestDetail(id);
  if (!detail) return null;
  const { request, vendor, payment, changes } = detail;
  const run = store.latestRunForRequest(id);
  let challenges: { id: string; label: string; prompt: string }[] = [];
  try {
    challenges = buildChallenges(detail).map(({ id, label, prompt }) => ({ id, label, prompt }));
  } catch {
    challenges = [];
  }
  return {
    request,
    vendor,
    payment,
    changes,
    preflight: preflight(detail, now),
    challenges,
    latestRun: run ? publicRun(run) : null,
    runs: store.listRunsForRequest(id).map(publicRun),
    /** A run that can still be answered or is on the line right now. */
    openRunId:
      store
        .listRunsForRequest(id)
        .find((r) => r.status === "live" || (r.status === "ringing" && !r.token_used && Date.parse(r.token_expires_at) >= now))?.id ?? null,
    dueInDays: Math.ceil((Date.parse(`${payment.due_on.slice(0, 10)}T00:00:00Z`) - now) / 86_400_000),
  };
}

export function runView(store: Store, id: string) {
  const run = store.getRun(id);
  if (!run) return null;
  const detail = store.getRequestDetail(run.request_id)!;
  return {
    run: publicRun(run),
    labels: checkLabels(detail),
    request: detail.request,
    vendor: { id: detail.vendor.id, name: detail.vendor.name, contact_name: detail.vendor.contact_name, contact_phone: detail.vendor.contact_phone },
    payment: detail.payment,
    checks: publicChecks(store.listChecks(id)),
    events: store.listEvents(id),
    testerSheet: run.status === "ended" ? null : testerSheet(detail),
  };
}

/**
 * What the real vendor would know, from the sample ledger. Shown to the person testing the
 * call on the AP screen so they can play the vendor. Never sent to the vendor call page.
 */
export function testerSheet(detail: NonNullable<ReturnType<Store["getRequestDetail"]>>) {
  let answers: { label: string; prompt: string; answer: string }[] = [];
  try {
    answers = buildChallenges(detail).map((c) => ({
      label: c.label,
      prompt: c.prompt,
      answer:
        c.kind === "amount"
          ? ((c.expected as number) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
          : new Date(`${c.expected as string}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }),
    }));
  } catch {
    answers = [];
  }
  return {
    contactName: detail.vendor.contact_name,
    vendorName: detail.vendor.name,
    newBank: `${detail.request.new_bank_name}, ending ${detail.request.new_account_last4}`,
    answers,
  };
}
