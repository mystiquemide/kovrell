import WebSocket from "ws";
import type { RequestDetail } from "../store";
import type { Challenge, ChallengeId } from "../verification/challenges";
import { VerificationSession, type CheckState, type VerdictResult } from "../verification/session";
import { buildSessionUpdate } from "./config";

export const AAI_WS_URL = "wss://agents.assemblyai.com/v1/ws";
export const MAX_CALL_MS = 6 * 60 * 1000;
const READY_TIMEOUT_MS = 12_000;

/** Hold-mode tools: the agent goes silent and there may be no reply.done, so results go out at once. */
export const HOLD_TOOLS = new Set(["finish_verification"]);
const CLOSING_TIMEOUT_MS = 15_000;

export const CLOSING_LINE = "That's everything. Thanks for your help. Our accounts payable team will follow up by email. Have a good day.";

export type AgentEvent =
  | { kind: "state"; state: "connecting" | "ready" | "ended"; sessionId?: string; reason?: string }
  | { kind: "agent"; text: string; interrupted: boolean }
  | { kind: "vendor"; text: string; final: boolean; itemId?: string }
  | { kind: "speech"; speaking: boolean }
  | { kind: "tool"; name: string; args: Record<string, unknown> }
  | { kind: "check"; check: CheckState }
  | { kind: "verdict"; result: VerdictResult }
  | { kind: "error"; code: string; message: string };

export interface AgentSessionOptions {
  apiKey: string;
  company: string;
  detail: RequestDetail;
  challenges: Challenge[];
  inputEncoding?: "audio/pcm" | "audio/pcmu";
  outputEncoding?: "audio/pcm" | "audio/pcmu";
  url?: string;
  maxCallMs?: number;
}

export interface EndResult {
  reason: string;
  verdict: VerdictResult;
  sessionId: string | null;
  finished: boolean;
}

/**
 * One verification call against the AssemblyAI Voice Agent API. Runs on the Kovrell server,
 * so the party being verified never sees prompts, tools, or results.
 */
export class AgentSession {
  readonly verification: VerificationSession;
  sessionId: string | null = null;
  private ws: WebSocket | null = null;
  private ready = false;
  private ended = false;
  private finished = false;
  private awaitingClosing = false;
  private closingReplyStarted = false;
  private closingSpoken = false;
  private lastEvent: string | null = null;
  private pendingResults: { call_id: string; result: string }[] = [];
  private timers: NodeJS.Timeout[] = [];
  private eventListeners: ((e: AgentEvent) => void)[] = [];
  private audioListeners: ((b64: string) => void)[] = [];
  private flushListeners: (() => void)[] = [];
  private endListeners: ((r: EndResult) => void)[] = [];

  constructor(private opts: AgentSessionOptions) {
    this.verification = new VerificationSession({
      contactName: opts.detail.vendor.contact_name,
      vendorName: opts.detail.vendor.name,
      challenges: opts.challenges,
    });
    this.verification.onCheck((check) => this.emit({ kind: "check", check }));
  }

  onEvent(cb: (e: AgentEvent) => void) {
    this.eventListeners.push(cb);
  }
  /** Agent speech, base64 in the configured output encoding. */
  onAudio(cb: (b64: string) => void) {
    this.audioListeners.push(cb);
  }
  /** Vendor barged in: drop any queued agent audio. */
  onFlush(cb: () => void) {
    this.flushListeners.push(cb);
  }
  onEnd(cb: (r: EndResult) => void) {
    this.endListeners.push(cb);
  }

  get isReady() {
    return this.ready;
  }

  start(): void {
    this.emit({ kind: "state", state: "connecting" });
    const ws = new WebSocket(this.opts.url ?? AAI_WS_URL, {
      headers: { Authorization: `Bearer ${this.opts.apiKey}` },
    });
    this.ws = ws;

    ws.on("open", () => {
      ws.send(
        JSON.stringify(
          buildSessionUpdate({
            company: this.opts.company,
            detail: this.opts.detail,
            challenges: this.opts.challenges,
            inputEncoding: this.opts.inputEncoding ?? "audio/pcm",
            outputEncoding: this.opts.outputEncoding ?? "audio/pcm",
          }),
        ),
      );
    });
    ws.on("message", (raw) => this.handle(JSON.parse(String(raw))));
    ws.on("error", (err) => {
      this.emit({ kind: "error", code: "socket_error", message: err.message });
      this.finish("provider_error");
    });
    ws.on("close", () => this.finish(this.ended ? "closed" : "provider_disconnected"));

    this.timers.push(
      setTimeout(() => {
        if (!this.ready) {
          this.emit({ kind: "error", code: "ready_timeout", message: "Voice agent did not become ready." });
          this.end("ready_timeout");
        }
      }, READY_TIMEOUT_MS),
      setTimeout(() => this.end("max_duration"), this.opts.maxCallMs ?? MAX_CALL_MS),
    );
  }

  /** Vendor audio in, base64 in the configured input encoding. Dropped until the session is ready. */
  sendAudio(b64: string): void {
    if (!this.ready || this.ended || this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "input.audio", audio: b64 }));
  }

  /** Ends the call cleanly. Safe to call more than once. */
  end(reason: string): void {
    if (this.ended) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "session.end" }));
      this.timers.push(setTimeout(() => this.ws?.close(), 2_000));
    }
    this.finish(reason);
  }

  private handle(e: Record<string, unknown> & { type: string }) {
    switch (e.type) {
      case "session.ready":
        this.ready = true;
        this.sessionId = e.session_id as string;
        this.emit({ kind: "state", state: "ready", sessionId: this.sessionId });
        break;
      case "reply.audio":
        for (const cb of this.audioListeners) cb(e.data as string);
        break;
      case "transcript.agent":
        this.emit({ kind: "agent", text: e.text as string, interrupted: Boolean(e.interrupted) });
        // Only speech from the reply that follows the closing result counts as the closing line.
        if (this.closingReplyStarted) this.closingSpoken = true;
        break;
      case "transcript.user.delta":
        this.emit({ kind: "vendor", text: e.text as string, final: false, itemId: e.item_id as string });
        break;
      case "transcript.user":
        this.emit({ kind: "vendor", text: e.text as string, final: true, itemId: e.item_id as string });
        break;
      case "input.speech.started":
        this.emit({ kind: "speech", speaking: true });
        break;
      case "input.speech.stopped":
        this.emit({ kind: "speech", speaking: false });
        break;
      case "tool.call":
        this.runTool(e.call_id as string, e.name as string, (e.arguments ?? {}) as Record<string, unknown>);
        break;
      case "reply.started":
        if (this.awaitingClosing) this.closingReplyStarted = true;
        break;
      case "reply.done":
        if (e.status === "interrupted") for (const cb of this.flushListeners) cb();
        break;
      case "session.error":
        this.emit({ kind: "error", code: String(e.code), message: String(e.message) });
        if (!this.ready) this.end("provider_error");
        break;
      case "session.ended":
        this.finish(this.finished ? "completed" : "provider_ended");
        break;
    }

    // Tool results go out only when reply.done is the latest event.
    if (["reply.started", "input.speech.started", "reply.done"].includes(e.type)) this.lastEvent = e.type;
    if (e.type === "reply.done") {
      this.flushResults();
      // Hang up once the closing line has been spoken in full.
      if (this.closingSpoken && e.status === "completed") this.end("completed");
    }
  }

  private runTool(callId: string, name: string, args: Record<string, unknown>) {
    this.emit({ kind: "tool", name, args });
    const v = this.verification;
    let result: Record<string, unknown> = { recorded: true };
    try {
      switch (name) {
        case "confirm_identity":
          if (args.confirmed_by_caller !== true) {
            // Not a confirmation yet. Nothing is recorded, so the agent must ask again.
            result = { recorded: false, next: "The caller has not confirmed who they are. Ask who you are speaking with." };
            break;
          }
          v.confirmIdentity(String(args.name ?? ""), String(args.company ?? ""));
          break;
        case "record_request_status":
          v.recordRequestStatus(Boolean(args.vendor_says_requested), String(args.note ?? ""));
          if (args.vendor_says_requested === false) result = { recorded: true, next: "Thank them and call finish_verification." };
          break;
        case "check_challenge": {
          v.checkChallenge(String(args.question_id) as ChallengeId, String(args.answer ?? ""));
          const pending = v.pendingChallenges();
          result = pending.length
            ? { recorded: true, next: `Ask question ${pending[0]}.` }
            : { recorded: true, next: "All questions asked. Do the readback." };
          break;
        }
        case "confirm_readback":
          v.confirmReadback(Boolean(args.confirmed));
          result = { recorded: true, next: "Call finish_verification." };
          break;
        case "finish_verification":
          this.finished = true;
          this.emit({ kind: "verdict", result: v.verdict() });
          result = { closing_line: CLOSING_LINE };
          break;
        default:
          result = { error: `Unknown tool ${name}. Use only the listed tools.` };
      }
    } catch (err) {
      result = { error: (err as Error).message };
    }
    if (HOLD_TOOLS.has(name)) {
      this.sendResult(callId, JSON.stringify(result));
      return;
    }
    this.pendingResults.push({ call_id: callId, result: JSON.stringify(result) });
    this.flushResults();
  }

  private flushResults() {
    if (this.lastEvent !== "reply.done" || this.ws?.readyState !== WebSocket.OPEN) return;
    for (const r of this.pendingResults.splice(0)) this.sendResult(r.call_id, r.result);
  }

  private sendResult(callId: string, result: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "tool.result", call_id: callId, result }));
    // Arm the hangup only once the agent has the closing line to speak.
    if (result.includes('"closing_line"')) {
      this.awaitingClosing = true;
      // If the closing line never arrives, end anyway so the run cannot hang live.
      this.timers.push(setTimeout(() => this.end("completed"), CLOSING_TIMEOUT_MS));
    }
  }

  private finish(reason: string) {
    if (this.ended) return;
    this.ended = true;
    for (const t of this.timers) clearTimeout(t);
    let verdict = this.verification.verdict();
    // Fail closed: a PASS only stands if the agent reached finish_verification.
    if (verdict.verdict === "PASS" && !this.finished) {
      verdict = { verdict: "INCONCLUSIVE", reason: `Call ended before verification finished (${reason}).` };
    }
    this.emit({ kind: "state", state: "ended", reason });
    const result = { reason, verdict, sessionId: this.sessionId, finished: this.finished };
    for (const cb of this.endListeners) cb(result);
  }

  private emit(e: AgentEvent) {
    for (const cb of this.eventListeners) cb(e);
  }
}
