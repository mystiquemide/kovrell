import type { WebSocket } from "ws";

/** Audio transport between Kovrell and the vendor. The agent never knows which one it is on. */
export interface CallChannel {
  kind: "browser" | "phone";
  inputEncoding: "audio/pcm" | "audio/pcmu";
  outputEncoding: "audio/pcm" | "audio/pcmu";
  onAudio(cb: (b64: string) => void): void;
  onHangup(cb: (reason: string) => void): void;
  sendAudio(b64: string): void;
  flush(): void;
  setState(state: "connecting" | "live" | "ended"): void;
  hangup(reason: string): void;
}

/**
 * Vendor softphone in the browser. Messages in: {type:"audio", data} (PCM16 24 kHz, base64),
 * {type:"hangup"}. Messages out: audio, flush, state. The vendor never receives transcripts,
 * tool calls, or checks.
 */
export class BrowserChannel implements CallChannel {
  readonly kind = "browser" as const;
  readonly inputEncoding = "audio/pcm" as const;
  readonly outputEncoding = "audio/pcm" as const;
  private audioCbs: ((b64: string) => void)[] = [];
  private hangupCbs: ((reason: string) => void)[] = [];
  private ended = false; // hangup callbacks fired
  private closed = false; // socket close started

  constructor(private ws: WebSocket) {
    ws.on("message", (raw, isBinary) => {
      if (isBinary) return;
      let msg: { type?: string; data?: unknown };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === "audio" && typeof msg.data === "string") for (const cb of this.audioCbs) cb(msg.data);
      if (msg.type === "hangup") this.remoteHangup("vendor_hangup");
    });
    ws.on("close", () => this.remoteHangup("vendor_disconnected"));
  }

  onAudio(cb: (b64: string) => void) {
    this.audioCbs.push(cb);
  }

  onHangup(cb: (reason: string) => void) {
    this.hangupCbs.push(cb);
  }

  sendAudio(b64: string) {
    this.send({ type: "audio", data: b64 });
  }

  flush() {
    this.send({ type: "flush" });
  }

  setState(state: "connecting" | "live" | "ended") {
    this.send({ type: "state", state });
  }

  hangup(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.ended = true;
    this.send({ type: "state", state: "ended" });
    // Give queued agent audio a moment to reach the vendor before closing.
    setTimeout(() => this.ws.close(1000, reason), 1500);
  }

  private remoteHangup(reason: string) {
    // The socket still gets closed by hangup() once the call has wrapped up.
    if (this.ended) return;
    this.ended = true;
    for (const cb of this.hangupCbs) cb(reason);
  }

  private send(msg: object) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
