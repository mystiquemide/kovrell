import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb } from "./db";
import { canonicalJson, downsample, median, medianResponseMs, sealEvidence, type Session } from "./evidence";
import { LevelMeter, rms } from "./levels";
import { createStore } from "./store";

const NOW = Date.parse("2026-09-24T12:00:00Z");

function storeWithEndedRun(sessionId: string | null) {
  const store = createStore(openDb(":memory:"));
  store.seedIfEmpty(NOW);
  store.createRun({
    id: "run_t1",
    request_id: "req_halden",
    channel: "browser",
    call_token: "tok_aaaaaaaaaaaaaaaaaaaaaaaa",
    token_expires_at: new Date(NOW + 900_000).toISOString(),
    started_at: new Date(NOW).toISOString(),
  });
  store.addEvent("run_t1", 0, "state", { state: "ringing", provenance: [{ key: "number_age", status: "ok" }] });
  store.updateRun("run_t1", { status: "ended", verdict: "FAIL", reason: "denied", aai_session_id: sessionId });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe("canonicalJson", () => {
  it("is independent of key order", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 2], c: null } })).toBe(canonicalJson({ a: { c: null, d: [1, 2] }, b: 1 }));
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("timing helpers", () => {
  it("median picks the middle value", () => {
    expect(median([900, 300, 600])).toBe(600);
    expect(median([])).toBeNull();
  });

  it("medianResponseMs pairs user speech end with the next reply start", () => {
    const turns = [
      { trigger: "greeting", user_transcript: null, user_speech_ended_at_ms: null, agent_reply_started_at_ms: 0, agent_text: "hi" },
      { trigger: "user_speech", user_transcript: "yes", user_speech_ended_at_ms: 1000, agent_reply_started_at_ms: null, agent_text: null },
      { trigger: "tool_result", user_transcript: null, user_speech_ended_at_ms: null, agent_reply_started_at_ms: 1800, agent_text: "ok" },
    ];
    expect(medianResponseMs(turns)).toBe(800);
  });

  it("downsample keeps peaks and the bar count", () => {
    const out = downsample(Array.from({ length: 1000 }, (_, i) => (i === 500 ? 0.9 : 0.1)), 100);
    expect(out).toHaveLength(100);
    expect(Math.max(...out)).toBe(0.9);
  });
});

describe("levels", () => {
  it("measures silence as zero and a loud tone as high", () => {
    const silence = Buffer.alloc(2400).toString("base64");
    const tone = Buffer.alloc(2400);
    for (let i = 0; i < 1200; i++) tone.writeInt16LE(Math.round(Math.sin(i / 3) * 16000), i * 2);
    expect(rms(silence, "audio/pcm")).toBe(0);
    expect(rms(tone.toString("base64"), "audio/pcm")).toBeGreaterThan(0.5);
  });

  it("meter keeps the loudest level per tick and records the series", () => {
    const m = new LevelMeter();
    m.addAgent(0.2);
    m.addAgent(0.6);
    m.addVendor(0.3);
    expect(m.tick()).toEqual({ agent: 0.6, vendor: 0.3 });
    expect(m.tick()).toEqual({ agent: 0, vendor: 0 });
    expect(m.series).toEqual([0.6, 0]);
  });
});

describe("sealEvidence", () => {
  it("seals with the provider timeline and a sha256 over the canonical record", async () => {
    const store = storeWithEndedRun("sess_1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ turns: [] }), { headers: { "content-type": "application/json" } })),
    );
    const session: Session = {
      id: "sess_1",
      status: "completed",
      duration_seconds: 40,
      artifacts: [
        { type: "audio", url: "https://s3.test/a.ogg", content_type: "audio/ogg" },
        { type: "timeline", url: "https://s3.test/t.json", content_type: "application/json" },
      ],
    };
    const ev = (await sealEvidence(store, "run_t1", [0.1, 0.5], async () => session, [700, 500, 900]))!;
    expect(ev.status).toBe("sealed");
    expect(ev.audio_available).toBe(true);
    expect(ev.median_response_ms).toBe(700);
    expect(ev.sha256).toBe(createHash("sha256").update(canonicalJson(ev.record)).digest("hex"));
    expect(store.getRun("run_t1")!.evidence_sha256).toBe(ev.sha256);
    expect((ev.record as { provenance_at_call: unknown }).provenance_at_call).toEqual([{ key: "number_age", status: "ok" }]);
  });

  it("stays pending while the provider is still processing", async () => {
    const store = storeWithEndedRun("sess_2");
    const ev = await sealEvidence(store, "run_t1", [], async () => ({ id: "sess_2", status: "active", duration_seconds: null, artifacts: [] }));
    expect(ev!.status).toBe("pending");
  });

  it("is unavailable when the run never reached the provider", async () => {
    const ev = await sealEvidence(storeWithEndedRun(null), "run_t1", [], null);
    expect(ev!.status).toBe("unavailable");
    expect(ev!.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
