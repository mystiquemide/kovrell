"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "ringing" | "connecting" | "live" | "ended" | "error";

const OUTPUT_RATE = 24000;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64Pcm16(b64: string): Float32Array {
  const bin = atob(b64);
  const out = new Float32Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) {
    let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

/** Plays agent audio chunks back to back, and drops everything queued on barge-in. */
class Player {
  private ctx = new AudioContext();
  private next = 0;
  private sources = new Set<AudioBufferSourceNode>();

  play(samples: Float32Array) {
    const buf = this.ctx.createBuffer(1, samples.length, OUTPUT_RATE);
    buf.copyToChannel(new Float32Array(samples), 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.05, this.next);
    src.start(at);
    this.next = at + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  flush() {
    for (const s of this.sources) s.stop();
    this.sources.clear();
    this.next = 0;
  }

  /** Seconds of audio still queued. */
  pending() {
    return Math.max(0, this.next - this.ctx.currentTime);
  }

  close() {
    this.flush();
    void this.ctx.close();
  }
}

export function VendorCall({ token, company, callerLine }: { token: string; company: string; callerLine: string }) {
  const [phase, setPhase] = useState<Phase>("ringing");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => () => cleanup.current(), []);

  async function answer() {
    setPhase("connecting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
      });
    } catch {
      setError("Microphone access is needed to take this call.");
      setPhase("error");
      return;
    }

    const player = new Player();
    const captureCtx = new AudioContext();
    await captureCtx.audioWorklet.addModule("/capture-worklet.js");
    const source = captureCtx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(captureCtx, "capture-processor");
    source.connect(node);

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws/vendor/${token}`);
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "audio", data: toBase64(e.data) }));
    };

    let ended = false;
    const finish = (next: Phase) => {
      if (ended) return;
      ended = true;
      // Let the closing line finish playing before tearing down audio.
      setTimeout(() => {
        node.disconnect();
        source.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        void captureCtx.close();
        player.close();
        setPhase(next);
      }, next === "ended" ? player.pending() * 1000 + 300 : 0);
    };
    cleanup.current = () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "hangup" }));
      ws.close();
      finish("ended");
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "audio") player.play(fromBase64Pcm16(msg.data));
      else if (msg.type === "flush") player.flush();
      else if (msg.type === "state" && msg.state === "live") setPhase("live");
      else if (msg.type === "state" && msg.state === "ended") finish("ended");
      else if (msg.type === "error") {
        setError(msg.reason);
        finish("error");
      }
    };
    ws.onclose = () => finish("ended");
    ws.onerror = () => {
      setError("The call could not connect.");
      finish("error");
    };
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div className="border border-rule bg-white/40 p-6">
        <p className="font-mono text-xs tracking-[0.18em] text-muted">
          {phase === "ringing" ? "INCOMING VERIFICATION CALL" : phase === "live" ? `ON CALL  ${mmss}` : phase.toUpperCase()}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{company} accounts payable</h1>
        <p className="mt-2 text-sm text-muted">{callerLine}</p>

        {phase === "ringing" && (
          <div className="mt-8 flex gap-3">
            <button onClick={answer} className="h-10 flex-1 rounded-md bg-ink text-sm font-medium text-paper">
              Answer
            </button>
          </div>
        )}
        {(phase === "connecting" || phase === "live") && (
          <div className="mt-8">
            <p className="mb-4 text-sm">{phase === "connecting" ? "Connecting..." : "Speak normally. The agent can hear you."}</p>
            <button
              onClick={() => cleanup.current()}
              className="h-10 w-full rounded-md border border-block text-sm font-medium text-block"
            >
              Hang up
            </button>
          </div>
        )}
        {phase === "ended" && <p className="mt-8 text-sm">Call ended. You can close this page.</p>}
        {phase === "error" && <p className="mt-8 text-sm text-block">{error}</p>}
      </div>
      <p className="text-xs text-muted">
        This is an automated call. It is recorded for payment verification. {company} will never ask for passwords or
        card numbers.
      </p>
    </main>
  );
}
