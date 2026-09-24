import { createHash } from "node:crypto";
import type { Store } from "./store";
import { publicRun } from "./views";

export const AAI_API = "https://agents.assemblyai.com/v1";

export interface SessionArtifact {
  type: "audio" | "timeline" | "metadata";
  url: string;
  content_type: string;
}

export interface Session {
  id: string;
  status: string;
  duration_seconds: number | null;
  artifacts: SessionArtifact[];
}

interface TimelineTurn {
  trigger: string | null;
  user_transcript: string | null;
  user_speech_ended_at_ms: number | null;
  agent_reply_started_at_ms: number | null;
  agent_text: string | null;
  tool_calls?: unknown[];
}

type Timeline = { turns: TimelineTurn[] };

export type FetchSession = (sessionId: string) => Promise<Session | null>;

export function aaiSessionFetcher(apiKey: string): FetchSession {
  return async (sessionId) => {
    const res = await fetch(`${AAI_API}/sessions/${sessionId}`, { headers: { Authorization: apiKey } });
    if (!res.ok) return null;
    return (await res.json()) as Session;
  };
}

/** JSON with sorted keys, so the seal is stable across runs of the same data. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Median gap between the vendor finishing a sentence and the agent starting its reply.
 * The timeline records a reply start on the turn after the user turn, so pair them in order.
 */
export function medianResponseMs(turns: TimelineTurn[]): number | null {
  const gaps: number[] = [];
  for (let i = 0; i < turns.length; i++) {
    const ended = turns[i].user_speech_ended_at_ms;
    if (!ended) continue;
    const reply = turns.slice(i).find((t) => t.agent_reply_started_at_ms && t.agent_reply_started_at_ms >= ended);
    if (reply?.agent_reply_started_at_ms) gaps.push(reply.agent_reply_started_at_ms - ended);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)]);
}

/** Downsamples a level series to a fixed bar count, keeping peaks so speech stays visible. */
export function downsample(levels: number[], bars = 160): number[] {
  if (levels.length <= bars) return levels.map((v) => Math.round(v * 1000) / 1000);
  const out: number[] = [];
  const step = levels.length / bars;
  for (let i = 0; i < bars; i++) {
    const slice = levels.slice(Math.floor(i * step), Math.floor((i + 1) * step));
    out.push(Math.round(Math.max(...slice) * 1000) / 1000);
  }
  return out;
}

/** Builds and stores the evidence record for a finished run. Safe to call again as artifacts arrive. */
export async function sealEvidence(
  store: Store,
  runId: string,
  levels: number[],
  fetchSession: FetchSession | null,
  responseGaps: number[] = [],
) {
  const run = store.getRun(runId);
  if (!run) return null;
  const detail = store.getRequestDetail(run.request_id)!;
  const events = store.listEvents(runId);
  const ringing = events.find((e) => e.kind === "state" && (e.payload as { state?: string }).state === "ringing");

  let timeline: Timeline | null = null;
  let audioAvailable = false;
  if (run.aai_session_id && fetchSession) {
    const session = await fetchSession(run.aai_session_id).catch(() => null);
    if (session?.status === "completed") {
      const tl = session.artifacts.find((a) => a.type === "timeline");
      audioAvailable = session.artifacts.some((a) => a.type === "audio");
      if (tl) timeline = (await fetch(tl.url).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as Timeline | null;
    }
  }

  const record = {
    kovrell_evidence_version: 1,
    run: publicRun(run),
    request: detail.request,
    vendor: {
      id: detail.vendor.id,
      name: detail.vendor.name,
      contact_name: detail.vendor.contact_name,
      contact_of_record: detail.vendor.contact_phone,
      bank_on_file: `${detail.vendor.bank_name} ending ${detail.vendor.account_last4}`,
    },
    provenance_at_call: (ringing?.payload as { provenance?: unknown } | undefined)?.provenance ?? null,
    checks: store.listChecks(runId),
    events: events.map(({ t_ms, kind, payload }) => ({ t_ms, kind, payload })),
    provider: { name: "AssemblyAI Voice Agent API", session_id: run.aai_session_id, timeline_turns: timeline?.turns.length ?? 0 },
  };
  const sha256 = createHash("sha256").update(canonicalJson(record)).digest("hex");
  const status = timeline ? "sealed" : run.aai_session_id && fetchSession ? "pending" : "unavailable";

  store.saveEvidence({
    run_id: runId,
    levels: downsample(levels),
    timeline,
    audio_available: audioAvailable,
    median_response_ms: median(responseGaps) ?? (timeline ? medianResponseMs(timeline.turns) : null),
    record,
    sha256,
    status,
    updated_at: new Date().toISOString(),
  });
  store.updateRun(runId, { evidence_sha256: sha256 });
  return store.getEvidence(runId);
}

/** Artifacts appear a few seconds after a session ends. Retry until sealed or out of attempts. */
export function sealWithRetry(
  store: Store,
  runId: string,
  levels: number[],
  fetchSession: FetchSession | null,
  responseGaps: number[] = [],
  attempts = 12,
  delayMs = 5_000,
) {
  const attempt = async (n: number) => {
    const ev = await sealEvidence(store, runId, levels, fetchSession, responseGaps).catch(() => null);
    if (ev?.status === "pending" && n < attempts) setTimeout(() => void attempt(n + 1), delayMs);
    else if (ev?.status === "pending") {
      store.saveEvidence({ ...ev, status: "unavailable", updated_at: new Date().toISOString() });
    }
  };
  void attempt(1);
}

/** Fresh signed recording URL for playback. The API key never leaves the server. */
export async function recordingUrl(fetchSession: FetchSession, sessionId: string): Promise<string | null> {
  const session = await fetchSession(sessionId).catch(() => null);
  return session?.artifacts.find((a) => a.type === "audio")?.url ?? null;
}
