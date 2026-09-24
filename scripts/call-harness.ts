/**
 * Runs a real verification call against the AssemblyAI Voice Agent API with a scripted vendor.
 * Vendor lines are spoken by a second Voice Agent session (voice "michael"), cached as 24 kHz
 * PCM16, and streamed into the call at real-time pace in reply to what the agent actually asks.
 *
 *   npx tsx scripts/call-harness.ts northwind   # genuine vendor, expect PASS
 *   npx tsx scripts/call-harness.ts halden      # vendor denies the change, expect FAIL
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import WebSocket from "ws";
import { AgentSession, AAI_WS_URL } from "../src/server/agent/agent-session";
import { openDb } from "../src/server/db";
import { createStore } from "../src/server/store";
import { buildChallenges } from "../src/server/verification/challenges";

const apiKey = process.env.ASSEMBLYAI_API_KEY;
if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not set");

const SAMPLE_RATE = 24_000;
const CHUNK_MS = 50;
const CHUNK_BYTES = (SAMPLE_RATE * 2 * CHUNK_MS) / 1000;
const CACHE = ".cache/vendor-lines";

async function synth(text: string): Promise<Buffer> {
  mkdirSync(CACHE, { recursive: true });
  const file = `${CACHE}/${createHash("sha1").update(text).digest("hex")}.pcm`;
  if (existsSync(file)) return readFileSync(file);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(AAI_WS_URL, { headers: { Authorization: `Bearer ${apiKey}` } });
    ws.on("open", () =>
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: { system_prompt: "Stay silent.", greeting: text, output: { voice: "michael" } },
        }),
      ),
    );
    ws.on("message", (raw) => {
      const e = JSON.parse(String(raw));
      if (e.type === "reply.audio") chunks.push(Buffer.from(e.data, "base64"));
      if (e.type === "reply.done") ws.send(JSON.stringify({ type: "session.end" }));
      if (e.type === "session.error") reject(new Error(e.message));
    });
    ws.on("close", () => resolve());
    ws.on("error", reject);
  });
  const pcm = Buffer.concat(chunks);
  writeFileSync(file, pcm);
  return pcm;
}

type Responder = (agentText: string) => string | null;

const store = createStore(openDb(":memory:"));
store.seedIfEmpty();

function spokenDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

const scenarios: Record<string, { requestId: string; respond: Responder }> = {
  northwind: {
    requestId: "req_northwind",
    respond: (t) => {
      const d = store.getRequestDetail("req_northwind")!;
      const paid = d.invoices.find((i) => i.number === "INV-4502")!;
      if (/speaking with/i.test(t)) return "Yes, this is Jide Okafor at Northwind Steel.";
      if (/request this change/i.test(t)) return "Yes, we did. We moved our operating account to Chase last month.";
      if (/4471/.test(t)) return "That one was ninety six thousand three hundred twenty five dollars.";
      if (/4502/.test(t) && /date|when/i.test(t)) return `We received it on ${spokenDate(paid.paid_on!)}.`;
      if (/4502/.test(t)) return "One hundred twenty seven thousand four hundred dollars.";
      if (/correct\?/i.test(t)) return "Yes, that's correct.";
      return null;
    },
  },
  halden: {
    requestId: "req_halden",
    respond: (t) => {
      if (/speaking with/i.test(t)) return "Yes, this is Maria Lindqvist at Halden Freight.";
      if (/request this change/i.test(t)) return "No, we haven't asked to change anything. Our bank is the same.";
      return null;
    },
  },
};

async function main() {
  const name = process.argv[2] ?? "northwind";
  const scenario = scenarios[name];
  if (!scenario) throw new Error(`Unknown scenario ${name}`);
  const detail = store.getRequestDetail(scenario.requestId)!;
  const t0 = Date.now();
  const log = (who: string, text: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s ${who.padEnd(7)} ${text}`);

  const agent = new AgentSession({ apiKey: apiKey!, company: "Acme Manufacturing", detail, challenges: buildChallenges(detail) });

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
