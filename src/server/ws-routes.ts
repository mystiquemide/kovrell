import type { WebSocket } from "ws";

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

export const wsRoutes: WsRoute[] = [{ pattern: /^\/ws\/health$/, handler: health }];
