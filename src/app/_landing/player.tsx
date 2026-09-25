"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Waveform } from "@/components/waveform";
import { clock } from "@/lib/format";

interface PlayerState {
  playing: boolean;
  time: number;
  length: number;
  error: string | null;
  toggle: () => void;
  seek: (fraction: number) => void;
}

const Ctx = createContext<PlayerState | null>(null);

/** One audio element for the recorded run, shared by every play control on the page. */
export function ShowcasePlayer({ src, children }: { src: string; children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setLength(a.duration);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setError("The recording could not play in this browser."));
  };

  const seek = (fraction: number) => {
    const a = audio.current;
    if (!a || !length) return;
    a.currentTime = fraction * length;
  };

  return (
    <Ctx.Provider value={{ playing, time, length, error, toggle, seek }}>
      <audio ref={audio} src={src} preload="metadata" />
      {children}
    </Ctx.Provider>
  );
}

function usePlayer() {
  const p = useContext(Ctx);
  if (!p) throw new Error("usePlayer must be used inside ShowcasePlayer");
  return p;
}

function PlayGlyph({ playing }: { playing: boolean }) {
  return playing ? (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="2" y="1" width="3.5" height="12" fill="currentColor" />
      <rect x="8.5" y="1" width="3.5" height="12" fill="currentColor" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 1l11 6-11 6z" fill="currentColor" />
    </svg>
  );
}

/** Hero call bar: which run, and a play control. */
export function CallBar({ label }: { label: string }) {
  const { playing, toggle, time, length, error } = usePlayer();
  return (
    <div>
      <div className="flex max-w-[560px] items-stretch overflow-hidden rounded-[12px] bg-black/60 text-white backdrop-blur-0">
        <span className="flex min-w-0 flex-1 items-center truncate px-4 py-3.5 text-[16px] text-white/90 sm:text-[18px]">{label}</span>
        <button onClick={toggle} className="flex shrink-0 items-center gap-2.5 bg-black px-4 font-display text-[16px] font-medium sm:px-5 sm:text-[18px]">
          <PlayGlyph playing={playing} />
          {playing ? "Pause" : "Play call"}
        </button>
      </div>
      <p className="mt-2 pl-1 text-[13px] text-white/70">
        {time > 0 && length ? `${clock(time * 1000)} / ${clock(length * 1000)}. ` : ""}
        {error ?? "A real Kovrell verification call. Vendor answers spoken by a scripted test caller."}
      </p>
    </div>
  );
}

/** Large play control for the mint band. */
export function BandPlay() {
  const { playing, toggle } = usePlayer();
  return (
    <button onClick={toggle} className="flex items-center gap-3 font-display text-[28px] font-semibold tracking-[-0.04em] text-black sm:text-[40px]">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-mint sm:h-12 sm:w-12">
        <PlayGlyph playing={playing} />
      </span>
      {playing ? "Pause the call" : "Play the verification call"}
    </button>
  );
}

/** Waveform of the same recording, with progress and click-to-seek. */
export function RecordingWave({ levels, height = 64 }: { levels: number[]; height?: number }) {
  const { time, length, seek, playing, toggle } = usePlayer();
  return (
    <button
      className="block w-full overflow-hidden text-left"
      aria-label="Seek the recording"
      onClick={(ev) => {
        const r = ev.currentTarget.getBoundingClientRect();
        seek((ev.clientX - r.left) / r.width);
        if (!playing) toggle();
      }}
    >
      <Waveform levels={levels} height={height} progress={time > 0 && length ? time / length : undefined} />
    </button>
  );
}

/**
 * Small checks panel for the hero. While the recording plays, each check turns to PASS at the
 * moment it passed on that call. When idle it shows the final result of the run.
 */
export function LiveChecks({
  checks,
  audioStartMs,
  amount,
  releasedTo,
}: {
  checks: { key: string; label: string; t: number }[];
  audioStartMs: number;
  amount: string;
  releasedTo: string;
}) {
  const { playing, time } = usePlayer();
  const idle = !playing && time === 0;
  const nowMs = time * 1000 + audioStartMs;
  const passed = (t: number) => idle || nowMs >= t;
  const done = checks.every((c) => passed(c.t));

  return (
    <div className="w-full max-w-[380px] rounded-[14px] border border-black/10 bg-white/95 p-5 text-left text-[#111013] backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="label text-[#71717a]">{idle ? "Checks on this call" : playing ? "Live checks" : "Checks, paused"}</p>
        {!idle && <span className="data text-[12px] text-[#71717a]">{clock(time * 1000)}</span>}
      </div>
      <ul className="mt-3">
        {checks.map((c) => {
          const ok = passed(c.t);
          return (
            <li key={c.key} className="flex items-center justify-between gap-3 border-t border-black/[0.07] py-2 text-[14px]">
              <span className={ok ? "text-[#111013]" : "text-[#71717a]"}>{c.label}</span>
              <span className={`label transition-colors ${ok ? "text-[#0b7a55]" : "text-[#a1a1aa]"}`}>{ok ? "Pass" : "Waiting"}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-black/[0.07] pt-3">
        <span className="data text-[15px]">{amount}</span>
        <span
          className={`label rounded-[5.6px] border px-2.5 py-1 transition-colors ${
            done ? "border-[#0b7a55] text-[#0b7a55]" : "border-[#d3cdbf] text-[#111013]"
          }`}
        >
          {done ? "Verified" : "Held"}
        </span>
      </div>
      <p className="mt-2 text-[12px] text-[#71717a]">{done ? `Released to ${releasedTo}.` : "Payment held until every check passes."}</p>
    </div>
  );
}
