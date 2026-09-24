import type { Run, StoredCheck, Store } from "./store";
import { buildChallenges } from "./verification/challenges";
import { preflight } from "./verification/provenance";

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
  };
}

export function runView(store: Store, id: string) {
  const run = store.getRun(id);
  if (!run) return null;
  const detail = store.getRequestDetail(run.request_id)!;
  return {
    run: publicRun(run),
    request: detail.request,
    vendor: { id: detail.vendor.id, name: detail.vendor.name, contact_name: detail.vendor.contact_name, contact_phone: detail.vendor.contact_phone },
    payment: detail.payment,
    checks: publicChecks(store.listChecks(id)),
    events: store.listEvents(id),
  };
}
