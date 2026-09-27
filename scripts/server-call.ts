/**
 * End-to-end check through a running Kovrell server: creates a run on the server's database,
 * watches it as the AP team, and answers the call link as a scripted vendor.
 *
 *   npx tsx scripts/server-call.ts northwind http://localhost:3000
 */
import WebSocket from "ws";
import { openDb } from "../src/server/db";
import { RunController } from "../src/server/runs";
import { createStore } from "../src/server/store";
import { CHUNK_BYTES, CHUNK_MS, genuineVendor, scenarios, synth } from "./lib/vendor-voice";

async function main() {
  const name = process.argv[2] ?? "northwind";
  const base = process.argv[3] ?? "http://localhost:3000";
  // Same SQLite file the server uses. createRun only touches the database.
  const store = createStore(openDb(process.env.DATABASE_PATH || "./data/kovrell.db"));
  store.seedIfEmpty();
  // A request id (req_...) plays a genuine vendor answering from that request's ledger.
  const scenario = name.startsWith("req_") ? genuineVendor(name, store) : scenarios[name];
  if (!scenario) throw new Error(`Unknown scenario ${name}`);
  const controller = new RunController({ store, apiKey: "unused", company: "Acme Manufacturing", publicBaseUrl: base });
  const { run, callUrl } = controller.createRun(scenario.requestId);
  console.log(`run ${run.id}  call link ${callUrl.replace(/\/v\/.{6}.*/, "/v/<token>")}`);

  const wsBase = base.replace(/^http/, "ws");
  const t0 = Date.now();
  const log = (who: string, text: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s ${who.padEnd(8)} ${text}`);

  let queue = Buffer.alloc(0);
  let vendorAudioIn = 0;
  const vendor = new WebSocket(`${wsBase}/ws/vendor/${run.call_token}`);
  vendor.on("message", (raw) => {
    const m = JSON.parse(String(raw));
    if (m.type === "audio") vendorAudioIn += Buffer.from(m.data, "base64").length;
    else if (m.type === "state") log("VENDOR", `state ${m.state}`);
    else if (m.type === "error") log("VENDOR", `error ${m.reason}`);
    else if (m.type !== "flush") log("VENDOR", `unexpected message ${m.type}`);
  });
  const silence = Buffer.alloc(CHUNK_BYTES);
  const pump = setInterval(() => {
    if (vendor.readyState !== WebSocket.OPEN) return;
    const chunk = Buffer.concat([queue.subarray(0, CHUNK_BYTES), silence]).subarray(0, CHUNK_BYTES);
    queue = queue.subarray(Math.min(queue.length, CHUNK_BYTES));
    vendor.send(JSON.stringify({ type: "audio", data: chunk.toString("base64") }));
  }, CHUNK_MS);

  const watch = new WebSocket(`${wsBase}/ws/watch/${run.id}`);
  watch.on("message", async (raw) => {
    const m = JSON.parse(String(raw));
    if (m.type === "snapshot") return log("WATCH", `snapshot: ${m.events.length} events, ${m.checks.length} checks`);
    if (m.type !== "event") return;
    const { kind, payload } = m.event;
    if (kind === "agent") {
      log("AGENT", payload.text);
      const line = scenario.respond(payload.text);
      if (line) {
        const pcm = await synth(line);
        setTimeout(() => {
          log("VENDOR>", line);
          queue = Buffer.concat([queue, pcm]);
        }, 700);
      }
    } else if (kind === "vendor") log("HEARD", payload.text);
    else if (kind === "tool") log("TOOL", `${payload.name}(${JSON.stringify(payload.args)})`);
    else if (kind === "check") log("CHECK", `${payload.check.key} -> ${payload.check.status}`);
    else if (kind === "outcome") log("OUTCOME", JSON.stringify(payload));
    else log(kind.toUpperCase(), JSON.stringify(payload));
  });
  watch.on("close", () => {
    clearInterval(pump);
    const final = store.getRun(run.id)!;
    const d = store.getRequestDetail(run.request_id)!;
    log("DONE", `run ${final.status} ${final.verdict} | request ${d.request.status} | payment ${d.payment.status} to ...${d.payment.destination_last4} | agent audio to vendor ${(vendorAudioIn / 48000).toFixed(1)}s | events ${store.listEvents(run.id).length}`);
    setTimeout(() => process.exit(0), 500);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
