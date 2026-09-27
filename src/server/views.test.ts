import { describe, expect, it } from "vitest";
import { openDb } from "./db";
import { createStore } from "./store";
import { publicRun, requestView } from "./views";

const NOW = Date.parse("2026-09-24T12:00:00Z");

describe("views", () => {
  it("request view carries provenance and the question pool but never ledger answers", () => {
    const store = createStore(openDb(":memory:"));
    store.seedIfEmpty(NOW);
    const view = requestView(store, "req_northwind", NOW)!;
    expect(view.preflight.locked).toBe(false);
    expect(view.questionPool).toEqual(["INV-4502", "INV-4471", "INV-4426", "INV-4388"]);
    const json = JSON.stringify(view);
    expect(json).not.toContain("9632500");
    expect(json).not.toContain("12740000");
  });

  it("never returns the vendor call token", () => {
    const run = publicRun({
      id: "run_1",
      request_id: "req_northwind",
      channel: "browser",
      call_token: "secret",
      token_expires_at: "",
      token_used: 0,
      aai_session_id: null,
      status: "ringing",
      verdict: null,
      reason: null,
      started_at: "",
      ended_at: null,
      evidence_sha256: null,
    });
    expect(run).not.toHaveProperty("call_token");
  });
});
