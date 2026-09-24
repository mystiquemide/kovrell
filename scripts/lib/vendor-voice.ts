import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import WebSocket from "ws";
import { AAI_WS_URL } from "../../src/server/agent/agent-session";
import { openDb } from "../../src/server/db";
import { createStore } from "../../src/server/store";

const apiKey = process.env.ASSEMBLYAI_API_KEY;
if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not set");

export const SAMPLE_RATE = 24_000;
export const CHUNK_MS = 50;
export const CHUNK_BYTES = (SAMPLE_RATE * 2 * CHUNK_MS) / 1000;
const CACHE = ".cache/vendor-lines";

export async function synth(text: string): Promise<Buffer> {
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

export type Responder = (agentText: string) => string | null;

// Scenario answers read dates from a freshly seeded ledger, matching a freshly seeded server.
const store = createStore(openDb(":memory:"));
store.seedIfEmpty();

function spokenDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export const scenarios: Record<string, { requestId: string; respond: Responder }> = {
  northwind: {
    requestId: "req_northwind",
    respond: (t) => {
      const d = store.getRequestDetail("req_northwind")!;
      const paid = d.invoices.find((i) => i.number === "INV-4502")!;
      if (/is this|speaking with/i.test(t)) return "Yes, this is Jide Okafor at Northwind Steel.";
      if (/ask for that change|request this change/i.test(t)) return "Yes, we did. We moved our operating account to Chase last month.";
      if (/4471/.test(t)) return "That one was ninety six thousand three hundred twenty five dollars.";
      if (/4502/.test(t) && /date|when/i.test(t)) return `We received it on ${spokenDate(paid.paid_on!)}.`;
      if (/4502/.test(t)) return "One hundred twenty seven thousand four hundred dollars.";
      if (/right\?|correct\?/i.test(t)) return "Yes, that's correct.";
      return null;
    },
  },
  halden: {
    requestId: "req_halden",
    respond: (t) => {
      if (/is this|speaking with/i.test(t)) return "Yes, this is Maria Lindqvist at Halden Freight.";
      if (/ask for that change|request this change/i.test(t)) return "No, we haven't asked to change anything. Our bank is the same.";
      return null;
    },
  },
};

