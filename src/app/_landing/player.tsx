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

/** Hero call card: the recorded verification call, playable, with its verdict. */
export function HeroCall({ title, meta, levels, stamp }: { title: string; meta: string; levels: number[]; stamp: ReactNode }) {
  const { playing, toggle, time, length, error, seek } = usePlayer();
  return (
    <div className="mx-auto w-full max-w-[760px] rounded-[20px] border border-line bg-white p-5 text-left sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label text-subtle">Recorded verification call</p>
          <p className="subheading mt-1.5 text-[18px] text-ink">{title}</p>
          <p className="mt-0.5 text-[14px] text-muted">{meta}</p>
        </div>
        {stamp}
      </div>
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause the call" : "Play the call"}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-opacity hover:opacity-85"
        >
          <PlayGlyph playing={playing} />
        </button>
        <button
          className="block min-w-0 flex-1 overflow-hidden text-left"
          aria-label="Seek the recording"
          onClick={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            seek((ev.clientX - r.left) / r.width);
            if (!playing) toggle();
          }}
        >
          <Waveform levels={levels} height={56} progress={time > 0 && length ? time / length : undefined} />
        </button>
      </div>
      <p className="mt-4 text-[13px] text-subtle">
        {time > 0 && length ? `${clock(time * 1000)} / ${clock(length * 1000)}. ` : ""}
        {error ?? "Kovrell's agent is live on the AssemblyAI Voice Agent API. The vendor's answers are spoken by a scripted test caller."}
      </p>
    </div>
  );
}

/** Text button that plays or pauses the same recording. */
export function PlayCallButton({ className }: { className: string }) {
  const { playing, toggle } = usePlayer();
  return (
    <button onClick={toggle} className={className}>
      <PlayGlyph playing={playing} />
      {playing ? "Pause the call" : "Play the call"}
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
