/**
 * Runs a real verification call against the AssemblyAI Voice Agent API with a scripted vendor.
 * Vendor lines are spoken by a second Voice Agent session (voice "michael"), cached as 24 kHz
 * PCM16, and streamed into the call at real-time pace in reply to what the agent actually asks.
 *
 *   npx tsx scripts/call-harness.ts northwind   # genuine vendor, expect PASS
 *   npx tsx scripts/call-harness.ts halden      # vendor denies the change, expect FAIL
 */
import { AgentSession } from "../src/server/agent/agent-session";
import { buildChallenges } from "../src/server/verification/challenges";
import { CHUNK_BYTES, CHUNK_MS, scenarios, synth } from "./lib/vendor-voice";
import { openDb } from "../src/server/db";
import { createStore } from "../src/server/store";

const apiKey = process.env.ASSEMBLYAI_API_KEY!;
const store = createStore(openDb(":memory:"));
store.seedIfEmpty();

async function main() {
  const name = process.argv[2] ?? "northwind";
  const scenario = scenarios[name];
  if (!scenario) throw new Error(`Unknown scenario ${name}`);
  const detail = store.getRequestDetail(scenario.requestId)!;
  const t0 = Date.now();
  const log = (who: string, text: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s ${who.padEnd(7)} ${text}`);

  const agent = new AgentSession({ apiKey, company: "Acme Manufacturing", detail, challenges: buildChallenges(detail) });

  // Continuous mic stream: silence unless a vendor line is queued.
  let queue = Buffer.alloc(0);
  const silence = Buffer.alloc(CHUNK_BYTES);
  const pump = setInterval(() => {
    const chunk = queue.length ? queue.subarray(0, CHUNK_BYTES) : silence;
    queue = queue.subarray(chunk.length);
    agent.sendAudio(Buffer.from(chunk.length === CHUNK_BYTES ? chunk : Buffer.concat([chunk, silence]).subarray(0, CHUNK_BYTES)).toString("base64"));
  }, CHUNK_MS);

  agent.onEvent(async (e) => {
    if (e.kind === "agent") {
      log("AGENT", e.text);
      const line = scenario.respond(e.text);
      if (line) {
        const pcm = await synth(line);
        setTimeout(() => {
          log("VENDOR>", line);
          queue = Buffer.concat([queue, pcm]);
        }, 700);
      }
    } else if (e.kind === "vendor" && e.final) log("HEARD", e.text);
    else if (e.kind === "tool") log("TOOL", `${e.name}(${JSON.stringify(e.args)})`);
    else if (e.kind === "check") log("CHECK", `${e.check.key} -> ${e.check.status}`);
    else if (e.kind === "verdict") log("VERDICT", `${e.result.verdict}: ${e.result.reason}`);
    else if (e.kind === "state") log("STATE", `${e.state}${e.sessionId ? ` ${e.sessionId}` : ""}${e.reason ? ` (${e.reason})` : ""}`);
    else if (e.kind === "error") log("ERROR", `${e.code}: ${e.message}`);
  });

  agent.onEnd((r) => {
    clearInterval(pump);
    log("END", `${r.verdict.verdict} | ${r.verdict.reason} | finished=${r.finished} | session=${r.sessionId}`);
    console.log("CHECKS", JSON.stringify(agent.verification.list().map((c) => [c.key, c.status, c.heard])));
    setTimeout(() => process.exit(0), 2500);
  });

  agent.start();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
