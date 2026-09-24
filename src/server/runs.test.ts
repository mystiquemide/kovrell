import { describe, expect, it } from "vitest";
import type { AgentSession, AgentSessionOptions, EndResult } from "./agent/agent-session";
import type { CallChannel } from "./channels";
import { openDb } from "./db";
import { CALL_LINK_TTL_MS, RunController } from "./runs";
import { createStore } from "./store";
import { VerificationSession, type VerdictResult } from "./verification/session";

const NOW = Date.parse("2026-09-24T12:00:00Z");

// Agent stand-in: records wiring and lets the test end the call with any verdict.
function fakeAgentFactory() {
  const agents: { end: (v: VerdictResult, finished?: boolean) => void; started: boolean }[] = [];
  const factory = (opts: AgentSessionOptions) => {
    let onEnd: (r: EndResult) => void = () => {};
    const verification = new VerificationSession({
      contactName: opts.detail.vendor.contact_name,
      vendorName: opts.detail.vendor.name,
      challenges: opts.challenges,
    });
    const handle = {
      started: false,
      end: (verdict: VerdictResult, finished = true) => onEnd({ reason: "completed", verdict, sessionId: "sess_x", finished }),
    };
    agents.push(handle);
    return {
      verification,
      onAudio() {},
      onFlush() {},
      onEvent() {},
      onEnd(cb: (r: EndResult) => void) {
        onEnd = cb;
      },
      sendAudio() {},
      end() {},
      start() {
        handle.started = true;
      },
    } as unknown as AgentSession;
  };
  return { factory, agents };
}

function fakeChannel(): CallChannel & { hungUp: string | null } {
  return {
    kind: "browser",
    inputEncoding: "audio/pcm",
    outputEncoding: "audio/pcm",
    hungUp: null,
    onAudio() {},
    onHangup() {},
    sendAudio() {},
    flush() {},
    setState() {},
    hangup(reason: string) {
      this.hungUp = reason;
    },
  };
}

function setup(now = NOW) {
  const store = createStore(openDb(":memory:"));
  store.seedIfEmpty(NOW);
  const { factory, agents } = fakeAgentFactory();
  let clock = now;
  const controller = new RunController({
    store,
    apiKey: "k",
    company: "Acme",
    publicBaseUrl: "https://kovrell.test",
    agentFactory: factory,
    now: () => clock,
  });
  return { store, controller, agents, advance: (ms: number) => (clock += ms) };
}

describe("RunController", () => {
  it("issues a call link for a held, unlocked request", () => {
    const { controller } = setup();
    const { run, callUrl } = controller.createRun("req_northwind");
    expect(run.status).toBe("ringing");
    expect(callUrl).toBe(`https://kovrell.test/v/${run.call_token}`);
    expect(run.call_token.length).toBeGreaterThanOrEqual(43);
  });

  it("refuses locked requests with the provenance reason", () => {
    expect(() => setup().controller.createRun("req_brightline")).toThrow("Number of record changed 6 days ago");
  });

  it("answers a link only once", () => {
    const { controller, agents } = setup();
    const { run } = controller.createRun("req_northwind");
    expect(controller.answer(run.call_token, fakeChannel())).toMatchObject({ ok: true });
    expect(agents[0].started).toBe(true);
    expect(controller.answer(run.call_token, fakeChannel())).toEqual({ ok: false, reason: "This call link has already been used." });
  });

  it("rejects expired links", () => {
    const { controller, advance } = setup();
    const { run } = controller.createRun("req_northwind");
    advance(CALL_LINK_TTL_MS + 1);
    expect(controller.answer(run.call_token, fakeChannel())).toEqual({ ok: false, reason: "This call link has expired." });
  });

  it("PASS releases payment to the new account", () => {
    const { controller, agents, store } = setup();
    const { run } = controller.createRun("req_northwind");
    const channel = fakeChannel();
    controller.answer(run.call_token, channel);
    agents[0].end({ verdict: "PASS", reason: "ok" });
    const d = store.getRequestDetail("req_northwind")!;
    expect(d.request.status).toBe("verified");
    expect(d.payment).toMatchObject({ status: "released", destination_last4: "8841" });
    expect(store.getRun(run.id)).toMatchObject({ status: "ended", verdict: "PASS", aai_session_id: "sess_x" });
    expect(channel.hungUp).toBe("completed");
  });

  it("FAIL blocks payment and keeps the account on file", () => {
    const { controller, agents, store } = setup();
    const { run } = controller.createRun("req_halden");
    controller.answer(run.call_token, fakeChannel());
    agents[0].end({ verdict: "FAIL", reason: "denied" });
    const d = store.getRequestDetail("req_halden")!;
    expect(d.request.status).toBe("blocked");
    expect(d.payment).toMatchObject({ status: "blocked", destination_last4: "5530" });
  });

  it("INCONCLUSIVE leaves the request and payment held, and allows a retry", () => {
    const { controller, agents, store } = setup();
    const { run } = controller.createRun("req_northwind");
    controller.answer(run.call_token, fakeChannel());
    agents[0].end({ verdict: "INCONCLUSIVE", reason: "dropped" }, false);
    const d = store.getRequestDetail("req_northwind")!;
    expect(d.request.status).toBe("held");
    expect(d.payment.status).toBe("held");
    expect(() => controller.createRun("req_northwind")).not.toThrow();
  });

  it("stores expected answers server side for the evidence record", () => {
    const { controller, store } = setup();
    const { run } = controller.createRun("req_northwind");
    controller.answer(run.call_token, fakeChannel());
    const q1 = store.listChecks(run.id).find((c) => c.key === "q1")!;
    expect(q1).toMatchObject({ status: "pending", expected: "96325.00" });
  });
});
