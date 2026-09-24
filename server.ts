import { createServer } from "node:http";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { RunController, setRunController } from "./src/server/runs";
import { getStore } from "./src/server/store";
import { wsRoutes } from "./src/server/ws-routes";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Next has loaded .env files by now.
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not set");
  setRunController(
    new RunController({
      store: getStore(),
      apiKey,
      company: process.env.KOVRELL_COMPANY_NAME || "Acme Manufacturing",
      publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${port}`,
    }),
  );

  const nextUpgrade = app.getUpgradeHandler();
  const wss = new WebSocketServer({ noServer: true });

  const server = createServer((req, res) => {
    handle(req, res);
  });

  // Our sockets live under /ws/. Everything else (Next dev HMR) goes to Next.
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (!url.pathname.startsWith("/ws/")) {
      nextUpgrade(req, socket, head);
      return;
    }
    const match = wsRoutes.find((r) => r.pattern.test(url.pathname));
    if (!match) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      const params = url.pathname.match(match.pattern)?.slice(1) ?? [];
      match.handler(ws, params, url);
    });
  });

  server.listen(port, () => {
    console.log(`> Kovrell listening on http://localhost:${port} (${dev ? "dev" : "production"})`);
  });
});
