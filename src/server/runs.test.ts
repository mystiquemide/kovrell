import { describe, expect, it } from "vitest";
import type { AgentSession, AgentSessionOptions, EndResult } from "./agent/agent-session";
import type { CallChannel } from "./channels";
import { openDb } from "./db";
import { CALL_LINK_TTL_MS, RunController } from "./runs";
import { createStore } from "./store";
import { buildChallenges } from "./verification/challenges";
import { VerificationSession, type VerdictResult } from "./verification/session";

const NOW = Date.parse("2026-09-24T12:00:00Z");

// Agent stand-in: records wiring and lets the test end the call with any verdict.
function fakeAgentFactory() {
  const agents: { opts: AgentSessionOptions; end: (v: VerdictResult, finished?: boolean) => void; started: boolean }[] = [];
  const factory = (opts: AgentSessionOptions) => {
    let onEnd: (r: EndResult) => void = () => {};
    const verification = new VerificationSession({
      contactName: opts.detail.vendor.contact_name,
      vendorName: opts.detail.vendor.name,
      challenges: opts.challenges,
    });
    const handle = {
      opts,
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
    const asked = buildChallenges(store.getRequestDetail("req_northwind")!, run.id)[0];
    expect(q1).toMatchObject({ status: "pending", expected: ((asked.expected as number) / 100).toFixed(2) });
  });

  it("calls on behalf of the vendor's payer when one is set, else the default company", () => {
    const { store, controller, agents } = setup();
    const v = store.createVendorLedger(
      { name: "Orbit Supplies", payer_name: "Globex Foods", contact_name: "Ada Park", contact_phone: "+1 555 0100", contact_email: "", bank_name: "Chase",
        account_last4: "1111", number_on_file_days: 400, payment_amount_cents: 5000,
        invoices: [{ number: "OS-1", amount_cents: 1000, paid_on: "2026-08-01" }, { number: "OS-2", amount_cents: 2000, paid_on: "2026-09-01" }] },
      NOW,
    );
    store.createRequest({ id: "req_o", vendor_id: v.id, channel: "email", new_bank_name: "Novo", new_account_last4: "2222", callback_contact: null, received_at: new Date(NOW).toISOString() });
    const { run } = controller.createRun("req_o");
    expect(controller.companyForToken(run.call_token)).toBe("Globex Foods");
    controller.answer(run.call_token, fakeChannel());
    expect(agents.at(-1)!.opts.company).toBe("Globex Foods");
    expect(controller.callerCompany(controller.createRun("req_northwind").run)).toBe("Acme");
    // A visitor's company is used for vendors without their own payer, and is fixed on the run.
    const visitorRun = controller.createRun("req_halden", "Initech").run;
    expect(visitorRun.caller_company).toBe("Initech");
    expect(controller.companyForToken(visitorRun.call_token)).toBe("Initech");
  });

  it("posts the verdict to the request's webhook when the call ends", async () => {
    const store = createStore(openDb(":memory:"));
    store.seedIfEmpty(NOW);
    store.setWebhook("req_northwind", "https://hooks.example.com/k", "whsec_x");
    const { factory, agents } = fakeAgentFactory();
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_u: URL, init: RequestInit) => (bodies.push(JSON.parse(init.body as string)), new Response(null, { status: 200 }))) as unknown as typeof fetch;
    const controller = new RunController({
      store, apiKey: "k", company: "Acme", publicBaseUrl: "https://kovrell.test", agentFactory: factory, now: () => NOW,
      webhook: { fetchImpl, resolve: async () => ["93.184.216.34"], delaysMs: [0] },
    });
    const { run } = controller.createRun("req_northwind");
    controller.answer(run.call_token, fakeChannel());
    agents[0].end({ verdict: "PASS", reason: "ok" } as VerdictResult);
    await new Promise((r) => setTimeout(r, 20));
    expect(bodies[0]).toMatchObject({
      event: "verification.completed",
      run_id: run.id,
      verdict: "PASS",
      payment: { status: "released", destination_last4: "8841" },
      evidence: { pdf: `https://kovrell.test/api/runs/${run.id}/pdf` },
    });
  });

  describe("manual verification", () => {
    const input = { verified_by: "Dana Cole", method: "in_person" as const, confirm_last4: "4480" };

    it("verifies a locked request in person, releases the payment, and seals a record without a call", async () => {
      const { store, controller } = setup();
      const run = await controller.recordManualVerification("req_brightline", input);
      expect(run).toMatchObject({ channel: "manual", status: "ended", verdict: "PASS" });
      expect(run.reason).toContain("Dana Cole");
      const d = store.getRequestDetail("req_brightline")!;
      expect(d.request.status).toBe("verified");
      expect(d.payment).toMatchObject({ status: "released", destination_last4: "4480" });
      expect(store.getEvidence(run.id)?.sha256).toMatch(/^[0-9a-f]{64}$/);
      const record = store.getEvidence(run.id)?.record as { provenance_at_call: unknown[] };
      expect(record.provenance_at_call.length).toBeGreaterThan(0);
    });

    it("refuses a callable request that hasn't been called, and a wrong account ending", async () => {
      const { controller } = setup();
      await expect(controller.recordManualVerification("req_northwind", { ...input, confirm_last4: "8841" })).rejects.toMatchObject({ code: "not_eligible" });
      await expect(controller.recordManualVerification("req_brightline", { ...input, confirm_last4: "0000" })).rejects.toMatchObject({ code: "mismatch" });
    });

    it("allows a request whose call was INCONCLUSIVE, but never overrides a FAIL", async () => {
      const { controller, agents } = setup();
      const first = controller.createRun("req_northwind").run;
      controller.answer(first.call_token, fakeChannel());
      agents[0].end({ verdict: "INCONCLUSIVE", reason: "dropped" } as VerdictResult, false);
      const run = await controller.recordManualVerification("req_northwind", { ...input, confirm_last4: "8841" });
      expect(run.verdict).toBe("PASS");

      const fail = controller.createRun("req_halden").run;
      controller.answer(fail.call_token, fakeChannel());
      agents[1].end({ verdict: "FAIL", reason: "denied" } as VerdictResult);
      await expect(controller.recordManualVerification("req_halden", { ...input, confirm_last4: "7712" })).rejects.toMatchObject({ code: "not_held" });
    });
  });

  it("deletes the AssemblyAI sessions of every run a reset removes", async () => {
    const store = createStore(openDb(":memory:"));
    store.seedIfEmpty(NOW);
    const deleted: string[] = [];
    const { factory } = fakeAgentFactory();
    const controller = new RunController({
      store, apiKey: "k", company: "Acme", publicBaseUrl: "https://kovrell.test", agentFactory: factory, now: () => NOW,
      deleteSession: async (id) => (deleted.push(id), true),
    });
    const { run } = controller.createRun("req_northwind");
    store.updateRun(run.id, { aai_session_id: "sess_abc" });
    expect(await controller.resetLedger()).toBe(1);
    expect(deleted).toEqual(["sess_abc"]);
    expect(store.getRun(run.id)).toBeNull();
  });
});
