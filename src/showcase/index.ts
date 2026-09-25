import run from "./northwind-run.json";

/**
 * A real Kovrell verification run, recorded 2026-09-24 and exported with its sealed evidence.
 * The agent side is Kovrell on the AssemblyAI Voice Agent API. The vendor answers were spoken
 * by a scripted test caller. The recording is public/showcase/northwind-verification.mp3.
 */
export const showcase = run;
export type Showcase = typeof run;
export type ShowcaseEvent = Showcase["events"][number];

export const SHOWCASE_AUDIO = "/showcase/northwind-verification.mp3";
export const SHOWCASE_RECORD = "/showcase/northwind-run.json";

function eventAt(pred: (e: ShowcaseEvent) => boolean) {
  return showcase.events.find(pred)?.t_ms ?? null;
}

const state = (s: string) => (e: ShowcaseEvent) => e.kind === "state" && (e.payload as { state?: string }).state === s;
const check = (k: string) => (e: ShowcaseEvent) => e.kind === "check" && (e.payload as { check?: { key: string } }).check?.key === k;

/** Milestones with the real offsets (ms from run start) at which they happened. */
export function milestones() {
  const outcome = eventAt((e) => e.kind === "outcome");
  return [
    { label: "Request held", t: 0 },
    { label: "Number verified", t: eventAt(state("ringing")) },
    { label: "Vendor called", t: eventAt(state("answered")) },
    { label: "Challenge passed", t: eventAt(check("q3")) },
    { label: "Payment released", t: outcome },
    { label: "Evidence sealed", t: outcome },
  ];
}

/** Check results in the order they were settled, with when and what the agent heard. */
export function checkTimeline() {
  return showcase.events
    .filter((e) => e.kind === "check")
    .map((e) => {
      const c = (e.payload as { check: { key: string; status: string; heard: string | null } }).check;
      const stored = showcase.checks.find((x) => x.key === c.key);
      return { t: e.t_ms, key: c.key, label: showcase.labels[c.key as keyof typeof showcase.labels] ?? c.key, status: c.status, heard: c.heard, expected: stored?.expected ?? null };
    });
}

export function transcript() {
  return showcase.events
    .filter((e) => e.kind === "agent" || e.kind === "vendor")
    .map((e) => ({ t: e.t_ms, who: e.kind as "agent" | "vendor", text: (e.payload as { text: string }).text }));
}

export function callLengthMs() {
  const a = eventAt(state("answered")) ?? 0;
  const o = eventAt((e) => e.kind === "outcome") ?? a;
  return o - a;
}

export const SHOWCASE_RUN_ID = showcase.run.id;

/** The showcase run in the same shape as a stored run's evidence view, for the evidence pages. */
export function showcaseEvidenceView() {
  return {
    run: showcase.run,
    vendor: showcase.vendor,
    request: showcase.request,
    payment: showcase.payment,
    labels: showcase.labels as Record<string, string>,
    checks: showcase.checks,
    events: showcase.events.map((e, i) => ({ id: i + 1, run_id: showcase.run.id, ...e })),
    evidence: {
      status: "sealed" as const,
      sha256: showcase.sha256,
      levels: showcase.levels,
      audio_available: true,
      median_response_ms: showcase.median_response_ms,
      updated_at: showcase.recorded_at,
    },
    record: showcase.record,
    audioSrc: SHOWCASE_AUDIO,
    downloadHref: SHOWCASE_RECORD,
    isShowcase: true,
  };
}
