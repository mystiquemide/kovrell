import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { openDb } from "../db";
import { createStore } from "../store";
import { buildChallenges } from "../verification/challenges";
import { AgentSession, CLOSING_LINE, type EndResult } from "./agent-session";

type Msg = Record<string, unknown> & { type: string };

// Minimal stand-in for the Voice Agent API socket, driven step by step by each test.
function fakeProvider() {
  const wss = new WebSocketServer({ port: 0 });
  const received: Msg[] = [];
  let client: WebSocket | null = null;
  const connected = new Promise<void>((resolve) =>
    wss.on("connection", (ws) => {
      client = ws;
      ws.on("message", (raw) => received.push(JSON.parse(String(raw))));
      resolve();
    }),
  );
  return {
    url: `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
    received,
    connected,
    send: (m: Msg) => client!.send(JSON.stringify(m)),
    close: () =>
      new Promise<void>((r) => {
        for (const c of wss.clients) c.terminate();
        wss.close(() => r());
      }),
  };
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

function makeSession(url: string) {
  const store = createStore(openDb(":memory:"));
  store.seedIfEmpty();
  const detail = store.getRequestDetail("req_northwind")!;
  return new AgentSession({ apiKey: "test", company: "Acme", detail, challenges: buildChallenges(detail), url });
}

let provider: ReturnType<typeof fakeProvider> | null = null;
afterEach(async () => {
  await provider?.close();
  provider = null;
});

describe("AgentSession", () => {
  it("configures the session with disclosure, tools, and no ledger values", async () => {
    provider = fakeProvider();
    const agent = makeSession(provider.url);
    agent.start();
    await provider.connected;
    await tick();
    const update = provider.received[0] as { type: string; session: Record<string, unknown> };
    expect(update.type).toBe("session.update");
    expect(String(update.session.greeting)).toMatch(/automated/);
    expect(String(update.session.greeting)).toMatch(/recorded/);
    expect(String(update.session.system_prompt)).not.toMatch(/96,?325|127,?400/);
    expect((update.session.tools as { name: string }[]).map((t) => t.name)).toEqual([
      "confirm_identity",
      "record_request_status",
      "check_challenge",
      "confirm_readback",
      "finish_verification",
    ]);
    agent.end("test");
  });

  it("holds tool results until reply.done is the latest event", async () => {
    provider = fakeProvider();
    const agent = makeSession(provider.url);
    agent.start();
    await provider.connected;
    provider.send({ type: "session.ready", session_id: "sess_1" });
    provider.send({ type: "reply.started" });
    provider.send({ type: "tool.call", call_id: "c1", name: "check_challenge", arguments: { question_id: "q1", answer: "96325" } });
    await tick();
    expect(provider.received.some((m) => m.type === "tool.result")).toBe(false);

    provider.send({ type: "reply.done", reply_id: "fc-c1", status: "completed" });
    await tick();
    const result = provider.received.find((m) => m.type === "tool.result")!;
    expect(result.call_id).toBe("c1");
    expect(JSON.parse(String(result.result))).not.toHaveProperty("correct");
    expect(agent.verification.get("q1").status).toBe("pass");
    agent.end("test");
  });

  it("does not record identity until the caller confirms who they are", async () => {
    provider = fakeProvider();
    const agent = makeSession(provider.url);
    agent.start();
    await provider.connected;
    provider.send({ type: "session.ready", session_id: "sess_4" });
    provider.send({ type: "reply.done", reply_id: "r0", status: "completed" });
    provider.send({
      type: "tool.call",
      call_id: "c1",
      name: "confirm_identity",
      arguments: { name: "Jide Okafor", company: "Northwind Steel", confirmed_by_caller: false },
    });
    await tick();
    const result = JSON.parse(String(provider.received.find((m) => m.type === "tool.result")!.result));
    expect(result.recorded).toBe(false);
    expect(agent.verification.get("identity").status).toBe("pending");
    agent.end("test");
  });

  it("downgrades PASS to INCONCLUSIVE when the call drops before finish_verification", async () => {
    provider = fakeProvider();
    const agent = makeSession(provider.url);
    const ended = new Promise<EndResult>((r) => agent.onEnd(r));
    agent.start();
    await provider.connected;
    provider.send({ type: "session.ready", session_id: "sess_2" });
    provider.send({ type: "reply.done", reply_id: "r0", status: "completed" });
    const calls: [string, Record<string, unknown>][] = [
      ["confirm_identity", { name: "Jide Okafor", company: "Northwind Steel", confirmed_by_caller: true }],
      ["record_request_status", { vendor_says_requested: true }],
      ["check_challenge", { question_id: "q1", answer: "96325" }],
      ["check_challenge", { question_id: "q2", answer: "127400" }],
      ["confirm_readback", { confirmed: true }],
    ];
    calls.forEach(([name, args], i) => provider!.send({ type: "tool.call", call_id: `c${i}`, name, arguments: args }));
    await tick();
    provider.send({ type: "session.ended" });
    const r = await ended;
    expect(r.finished).toBe(false);
    expect(r.verdict.verdict).toBe("INCONCLUSIVE");
  });

  it("speaks the closing line before hanging up", async () => {
    provider = fakeProvider();
    const agent = makeSession(provider.url);
    const ended = new Promise<EndResult>((r) => agent.onEnd(r));
    agent.start();
    await provider.connected;
    provider.send({ type: "session.ready", session_id: "sess_3" });
    provider.send({ type: "tool.call", call_id: "c9", name: "finish_verification", arguments: {} });
    // Filler speech in the same turn must not trigger the hangup.
    provider.send({ type: "transcript.agent", text: "One moment." });
    provider.send({ type: "reply.done", reply_id: "fc-c9", status: "completed" });
    await tick();
    const result = provider.received.find((m) => m.type === "tool.result")!;
    expect(JSON.parse(String(result.result))).toEqual({ closing_line: CLOSING_LINE });
    expect(provider.received.some((m) => m.type === "session.end")).toBe(false);

    provider.send({ type: "reply.started" });
    provider.send({ type: "transcript.agent", text: CLOSING_LINE });
    provider.send({ type: "reply.done", reply_id: "r5", status: "completed" });
    const r = await ended;
    await tick();
    expect(r.reason).toBe("completed");
    expect(provider.received.some((m) => m.type === "session.end")).toBe(true);
  });

  it("sends the hold-mode finish result at once, without waiting for reply.done", async () => {
    provider = fakeProvider();
    const agent = makeSession(provider.url);
    agent.start();
    await provider.connected;
    provider.send({ type: "session.ready", session_id: "sess_5" });
    provider.send({ type: "input.speech.started" });
    provider.send({ type: "tool.call", call_id: "c7", name: "finish_verification", arguments: {} });
    await tick();
    const result = provider.received.find((m) => m.type === "tool.result");
    expect(result?.call_id).toBe("c7");
    agent.end("test");
  });

  it("fails closed with INCONCLUSIVE when the provider rejects the session", async () => {
    provider = fakeProvider();
    const agent = makeSession(provider.url);
    const ended = new Promise<EndResult>((r) => agent.onEnd(r));
    agent.start();
    await provider.connected;
    provider.send({ type: "session.error", code: "UNAUTHORIZED", message: "bad key" });
    const r = await ended;
    expect(r.reason).toBe("provider_error");
    expect(r.verdict.verdict).toBe("INCONCLUSIVE");
  });
});
