import type { RequestDetail } from "../store";

export const PROVENANCE_WINDOW_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export type ProvenanceStatus = "ok" | "fail" | "info";

export interface ProvenanceCheck {
  key: "number_age" | "recent_contact_change" | "request_callback_ignored";
  label: string;
  status: ProvenanceStatus;
  detail: string;
}

export interface Preflight {
  checks: ProvenanceCheck[];
  locked: boolean;
  reason: string | null;
  numberOfRecord: string;
}

function daysBetween(iso: string, now: number): number {
  return Math.floor((now - Date.parse(iso)) / DAY);
}

/** Decides whether Kovrell may call the contact of record. Any failed check locks the call. */
export function preflight(detail: RequestDetail, now = Date.now()): Preflight {
  const { vendor, changes, request } = detail;
  const phoneChanges = changes.filter((c) => c.field === "contact_phone");
  const current = phoneChanges.filter((c) => c.new_value === vendor.contact_phone).at(-1);
  const checks: ProvenanceCheck[] = [];

  if (!current) {
    checks.push({
      key: "number_age",
      label: "Number of record age",
      status: "fail",
      detail: "No change log entry for the current number of record.",
    });
  } else {
    const age = daysBetween(current.changed_at, now);
    checks.push({
      key: "number_age",
      label: "Number of record age",
      status: age >= PROVENANCE_WINDOW_DAYS ? "ok" : "fail",
      detail: `On file since ${current.changed_at.slice(0, 10)} (${age} days).`,
    });
  }

  const recent = changes
    .filter((c) => c.field === "contact_phone" || c.field === "contact_email")
    .filter((c) => c.old_value !== null && daysBetween(c.changed_at, now) < PROVENANCE_WINDOW_DAYS)
    .at(-1);
  checks.push({
    key: "recent_contact_change",
    label: `Contact changed in last ${PROVENANCE_WINDOW_DAYS} days`,
    status: recent ? "fail" : "ok",
    detail: recent
      ? `${recent.field === "contact_phone" ? "Phone" : "Email"} changed ${daysBetween(recent.changed_at, now)} days ago via ${recent.source}.`
      : "No contact changes.",
  });

  checks.push({
    key: "request_callback_ignored",
    label: "Callback contact from the request",
    status: "info",
    detail: request.callback_contact
      ? `${request.callback_contact} came with the request. Not used.`
      : "The request gave no callback contact.",
  });

  const failed = checks.find((c) => c.status === "fail");
  let reason: string | null = null;
  // The specific recent-change reason is the most useful one, so it wins when present.
  if (failed && recent) {
    reason = `Number of record changed ${daysBetween(recent.changed_at, now)} days ago. Verify in person.`;
  } else if (failed) {
    reason = `${failed.label} failed. Verify in person.`;
  }
  return { checks, locked: Boolean(failed), reason, numberOfRecord: vendor.contact_phone };
}
