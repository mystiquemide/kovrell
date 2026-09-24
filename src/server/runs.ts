import { randomBytes, randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { AgentSession, type AgentEvent, type AgentSessionOptions, type EndResult } from "./agent/agent-session";
import type { CallChannel } from "./channels";
import type { Run, RunEvent, Store } from "./store";
import { buildChallenges, type Challenge } from "./verification/challenges";
import { preflight } from "./verification/provenance";

export const CALL_LINK_TTL_MS = 15 * 60 * 1000;

export class RunError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "locked" | "not_held" | "busy",
  ) {
    super(message);
  }
}

type AgentFactory = (opts: AgentSessionOptions) => AgentSession;

export interface RunControllerOptions {
  store: Store;
  apiKey: string;
  company: string;
  publicBaseUrl: string;
  agentFactory?: AgentFactory;
  now?: () => number;
}

interface LiveRun {
  agent: AgentSession;
  channel: CallChannel;
}

/** Owns every verification run: creation, the live call, persistence, the ledger outcome, and watchers. */
export class RunController {
  private live = new Map<string, LiveRun>();
  private watchers = new Map<string, Set<WebSocket>>();
  private now: () => number;
  private agentFactory: AgentFactory;

  constructor(private opts: RunControllerOptions) {
    this.now = opts.now ?? Date.now;
    this.agentFactory = opts.agentFactory ?? ((o) => new AgentSession(o));
  }

  /** Runs preflight and issues a single-use call link for the vendor's contact of record. */
  createRun(requestId: string): { run: Run; callUrl: string } {
    const { store } = this.opts;
    const detail = store.getRequestDetail(requestId);
    if (!detail) throw new RunError("Request not found.", "not_found");
    if (detail.request.status !== "held") throw new RunError("This request already has a decision.", "not_held");
    const check = preflight(detail, this.now());
    if (check.locked) throw new RunError(check.reason ?? "Call locked by provenance checks.", "locked");
    const current = store.latestRunForRequest(requestId);
    if (current && current.status === "live") throw new RunError("A verification call is already in progress.", "busy");
    buildChallenges(detail); // fail early if the ledger cannot support the questions

    const started = this.now();
    const run = {
      id: `run_${randomUUID().slice(0, 8)}`,
      request_id: requestId,
      channel: "browser",
      call_token: randomBytes(32).toString("base64url"),
      token_expires_at: new Date(started + CALL_LINK_TTL_MS).toISOString(),
      started_at: new Date(started).toISOString(),
    };
    store.createRun(run);
    this.record(run.id, "state", { state: "ringing", numberOfRecord: check.numberOfRecord });
    return { run: store.getRun(run.id)!, callUrl: `${this.opts.publicBaseUrl}/v/${run.call_token}` };
  }

  /** Validates a call link without claiming it. */
  inspectToken(token: string): { ok: true; run: Run } | { ok: false; reason: string } {
    const run = this.opts.store.getRunByToken(token);
    if (!run) return { ok: false, reason: "This call link is not valid." };
    if (run.token_used) return { ok: false, reason: "This call link has already been used." };
    if (Date.parse(run.token_expires_at) < this.now()) return { ok: false, reason: "This call link has expired." };
    if (run.status !== "ringing") return { ok: false, reason: "This call has ended." };
    return { ok: true, run };
  }

  /** The vendor answered. Claims the link and starts the agent on this channel. */
  answer(token: string, channel: CallChannel): { ok: true; runId: string } | { ok: false; reason: string } {
    const { store } = this.opts;
    const inspected = this.inspectToken(token);
    if (!inspected.ok) return inspected;
    if (!store.claimToken(token)) return { ok: false, reason: "This call link has already been used." };

    const run = inspected.run;
    const detail = store.getRequestDetail(run.request_id)!;
    const challenges = buildChallenges(detail);
    const agent = this.agentFactory({
      apiKey: this.opts.apiKey,
      company: this.opts.company,
      detail,
      challenges,
      inputEncoding: channel.inputEncoding,
      outputEncoding: channel.outputEncoding,
    });
    this.live.set(run.id, { agent, channel });
    store.updateRun(run.id, { status: "live" });
    for (const c of agent.verification.list()) {
      store.upsertCheck({ run_id: run.id, key: c.key, status: c.status, expected: expectedFor(c.key, challenges), heard: null });
    }

    channel.setState("connecting");
    channel.onAudio((b64) => agent.sendAudio(b64));
    channel.onHangup((reason) => agent.end(reason));
    agent.onAudio((b64) => channel.sendAudio(b64));
    agent.onFlush(() => channel.flush());
    agent.onEvent((e) => this.onAgentEvent(run.id, e, channel));
    agent.onEnd((r) => this.onEnd(run.id, r, channel));
    this.record(run.id, "state", { state: "answered", channel: channel.kind });
    agent.start();
    return { ok: true, runId: run.id };
  }

  /** Read-only live view. Sends the history first, then every new event. */
  watch(runId: string, ws: WebSocket): void {
    const { store } = this.opts;
    const run = store.getRun(runId);
    if (!run) {
      ws.close(4404, "run not found");
      return;
    }
    ws.send(JSON.stringify({ type: "snapshot", run, events: store.listEvents(runId), checks: store.listChecks(runId) }));
    if (run.status === "ended") return;
    let set = this.watchers.get(runId);
    if (!set) this.watchers.set(runId, (set = new Set()));
    set.add(ws);
    ws.on("close", () => set!.delete(ws));
  }

  isLive(runId: string) {
    return this.live.has(runId);
  }

  private onAgentEvent(runId: string, e: AgentEvent, channel: CallChannel) {
    const { store } = this.opts;
    // Partial transcripts go to watchers only. Everything else is part of the record.
    if (e.kind === "vendor" && !e.final) {
      this.broadcast(runId, { type: "partial", text: e.text, itemId: e.itemId });
      return;
    }
    if (e.kind === "speech") return;
    if (e.kind === "state" && e.state === "ready") {
      store.updateRun(runId, { aai_session_id: e.sessionId ?? null });
      channel.setState("live");
    }
    if (e.kind === "check") {
      store.upsertCheck({ run_id: runId, key: e.check.key, status: e.check.status, expected: null, heard: e.check.heard });
    }
    const { kind, ...payload } = e;
    this.record(runId, kind, payload);
  }

  private onEnd(runId: string, r: EndResult, channel: CallChannel) {
    const { store } = this.opts;
    const run = store.getRun(runId)!;
    const detail = store.getRequestDetail(run.request_id)!;
    store.updateRun(runId, {
      status: "ended",
      verdict: r.verdict.verdict,
      reason: r.verdict.reason,
      ended_at: new Date(this.now()).toISOString(),
      aai_session_id: r.sessionId,
    });
    if (r.verdict.verdict === "PASS") {
      store.setOutcome(run.request_id, "verified", "released", detail.request.new_account_last4);
    } else if (r.verdict.verdict === "FAIL") {
      store.setOutcome(run.request_id, "blocked", "blocked");
    }
    // INCONCLUSIVE leaves the request and payment held.
    this.record(runId, "outcome", {
      verdict: r.verdict.verdict,
      reason: r.verdict.reason,
      endReason: r.reason,
      finished: r.finished,
      payment: r.verdict.verdict === "PASS" ? "released" : r.verdict.verdict === "FAIL" ? "blocked" : "held",
    });
    channel.hangup(r.reason);
    this.live.delete(runId);
    for (const ws of this.watchers.get(runId) ?? []) ws.close(1000, "ended");
    this.watchers.delete(runId);
  }

  private record(runId: string, kind: string, payload: unknown): RunEvent {
    const run = this.opts.store.getRun(runId)!;
    const tMs = Math.max(0, this.now() - Date.parse(run.started_at));
    const event = this.opts.store.addEvent(runId, tMs, kind, payload);
    this.broadcast(runId, { type: "event", event });
    return event;
  }

  private broadcast(runId: string, msg: object) {
    const data = JSON.stringify(msg);
    for (const ws of this.watchers.get(runId) ?? []) if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

function expectedFor(key: string, challenges: Challenge[]): string | null {
  const c = challenges.find((x) => x.id === key);
  if (!c) return null;
  return c.kind === "amount" ? ((c.expected as number) / 100).toFixed(2) : String(c.expected);
}

// Process-wide controller shared by API routes and the socket server.
const g = globalThis as unknown as { __kovrellRuns?: RunController };

export function setRunController(controller: RunController) {
  g.__kovrellRuns = controller;
}

export function getRunController(): RunController {
  if (!g.__kovrellRuns) throw new Error("RunController not initialised. Start the app with server.ts.");
  return g.__kovrellRuns;
}
