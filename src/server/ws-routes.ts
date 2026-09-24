import type { WebSocket } from "ws";
import { BrowserChannel } from "./channels";
import { getRunController } from "./runs";

export type WsHandler = (ws: WebSocket, params: string[], url: URL) => void;

export interface WsRoute {
  pattern: RegExp;
  handler: WsHandler;
}

// Liveness check for load balancers and deploy verification.
const health: WsHandler = (ws) => {
  ws.send(JSON.stringify({ type: "health", ok: true, t: Date.now() }));
  ws.close(1000, "ok");
};

// Vendor answers the verification call. The socket carries audio only.
const vendor: WsHandler = (ws, [token]) => {
  const result = getRunController().answer(token, new BrowserChannel(ws));
  if (!result.ok) {
    ws.send(JSON.stringify({ type: "error", reason: result.reason }));
    ws.close(4403, "rejected");
  }
};

// AP team watches a run live. Read only: incoming messages are ignored.
const watch: WsHandler = (ws, [runId]) => {
  getRunController().watch(runId, ws);
};

export const wsRoutes: WsRoute[] = [
  { pattern: /^\/ws\/health$/, handler: health },
  { pattern: /^\/ws\/vendor\/([A-Za-z0-9_-]{20,})$/, handler: vendor },
  { pattern: /^\/ws\/watch\/(run_[a-z0-9]+)$/, handler: watch },
];
