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

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function words(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${words(n % 100)}` : ""}`;
  if (n < 1_000_000) return `${words(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${words(n % 1000)}` : ""}`;
  return `${words(Math.floor(n / 1_000_000))} million${n % 1_000_000 ? ` ${words(n % 1_000_000)}` : ""}`;
}

function spokenAmount(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  return `${words(dollars)} dollars${rest ? ` and ${words(rest)} cents` : ""}`;
}

/** Answers whichever invoice the agent asks about, straight from the ledger. */
function ledgerAnswer(requestId: string, t: string, source = store): string | null {
  const d = source.getRequestDetail(requestId)!;
  // The agent may read "PRL-1150" as "P R L one one five zero", so compare letters and digits only.
  const DIGITS: Record<string, string> = { zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };
  const heard = t.toLowerCase().replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => DIGITS[w]).replace(/[^a-z0-9]/g, "");
  const inv = d.invoices.find((i) => heard.includes(i.number.toLowerCase().replace(/[^a-z0-9]/g, "")));
  if (!inv) return null;
  if (/date|when/i.test(t)) return `We received it on ${spokenDate(inv.paid_on!)}.`;
  return `That one was ${spokenAmount(inv.amount_cents)}.`;
}

export const scenarios: Record<string, { requestId: string; respond: Responder }> = {
  northwind: {
    requestId: "req_northwind",
    respond: (t) => {
      if (/is this|speaking with/i.test(t)) return "Yes, this is Jide Okafor at Northwind Steel.";
      if (/ask for that change|request this change/i.test(t)) return "Yes, we did. We moved our operating account to Chase last month.";
      if (/right\?|correct\?/i.test(t)) return "Yes, that's correct.";
      return ledgerAnswer("req_northwind", t);
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

/** A genuine vendor for any request, answering from the given store. Used for vendors added on the Set up page. */
export function genuineVendor(requestId: string, source: ReturnType<typeof createStore>): { requestId: string; respond: Responder } {
  const d = source.getRequestDetail(requestId);
  if (!d) throw new Error(`Unknown request ${requestId}`);
  return {
    requestId,
    respond: (t) => {
      if (/is this|speaking with/i.test(t)) return `Yes, this is ${d.vendor.contact_name} at ${d.vendor.name}.`;
      if (/ask for that change|request this change/i.test(t)) return `Yes, we did. We moved our account to ${d.request.new_bank_name}.`;
      if (/right\?|correct\?/i.test(t)) return "Yes, that's correct.";
      return ledgerAnswer(requestId, t, source);
    },
  };
}
