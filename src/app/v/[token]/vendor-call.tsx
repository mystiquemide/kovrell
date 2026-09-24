"use client";

import { useEffect, useRef, useState } from "react";
import { Arrow, PRIMARY, SECONDARY } from "@/components/button";
import { Wordmark } from "@/components/mark";
import { Waveform } from "@/components/waveform";

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
  const [levels, setLevels] = useState<number[]>(() => Array(48).fill(0));
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
      if (msg.type === "audio") {
        const samples = fromBase64Pcm16(msg.data);
        player.play(samples);
        let sum = 0;
        for (const v of samples) sum += v * v;
        const level = Math.min(1, Math.sqrt(sum / Math.max(1, samples.length)) * 3);
        setLevels((prev) => [...prev.slice(1), level]);
      }
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
      <Wordmark />
      <div className="flex flex-1 flex-col justify-center py-12">
        <p className={`label ${phase === "error" ? "text-fail" : "text-subtle"}`}>
          {phase === "ringing"
            ? "Incoming verification call"
            : phase === "live"
              ? `On call  ${mmss}`
              : phase === "connecting"
                ? "Connecting"
                : phase === "ended"
                  ? "Call ended"
                  : "Call could not connect"}
        </p>
        <h1 className="heading mt-4 text-[40px]">{company}</h1>
        <p className="mt-1 text-[18px] text-muted">accounts payable</p>
        <p className="mt-6 text-ink-2">{callerLine}. About two minutes.</p>

        {(phase === "live" || phase === "connecting") && <Waveform levels={levels} height={48} className="mt-10 overflow-hidden" />}

        <div className="mt-10">
          {phase === "ringing" && (
            <button onClick={answer} className={`${PRIMARY} w-full`}>
              Answer <Arrow />
            </button>
          )}
          {(phase === "connecting" || phase === "live") && (
            <>
              <p className="mb-5 text-muted">{phase === "connecting" ? "Connecting to the verification agent." : "Speak normally. The agent can hear you."}</p>
              <button onClick={() => cleanup.current()} className={`${SECONDARY} w-full`}>
                Hang up
              </button>
            </>
          )}
          {phase === "ended" && <p className="text-muted">Thanks. You can close this page.</p>}
          {phase === "error" && <p className="text-fail">{error}</p>}
        </div>
      </div>
      <p className="border-t border-line pt-5 text-[13px] text-subtle">
        This call is automated and recorded. {company} will never ask for passwords or card numbers.
      </p>
    </main>
  );
}
