"use client";

import { useEffect, useRef, useState } from "react";
import { Waveform } from "@/components/waveform";
import { clock } from "@/lib/format";

/** Plays the real call recording (vendor left, agent right) with its stored waveform. */
export function Recording({ runId, levels, available }: { runId: string; levels: number[]; available: boolean }) {
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
    const onErr = () => {
      setError("The recording could not load. It may still be processing.");
      setPlaying(false);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onErr);
    };
  }, []);

  if (!available) {
    return <p className="text-mercury">The recording is processing. It appears here within a minute of the call ending.</p>;
  }

  return (
    <div>
      <audio ref={audio} src={`/api/runs/${runId}/audio`} preload="metadata" />
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            const a = audio.current;
            if (!a) return;
            if (playing) a.pause();
            else void a.play().catch(() => setError("The recording could not play."));
            setPlaying(!playing);
          }}
          className="label inline-flex h-10 w-24 items-center justify-center rounded-full bg-cream text-void hover:bg-bone"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <span className="data text-[14px] text-mercury">
          {clock(time * 1000)} / {length ? clock(length * 1000) : "--:--"}
        </span>
      </div>
      {levels.length > 0 && (
        <button
          className="mt-5 block w-full overflow-hidden text-left"
          aria-label="Seek recording"
          onClick={(ev) => {
            const a = audio.current;
            if (!a || !length) return;
            const r = ev.currentTarget.getBoundingClientRect();
            a.currentTime = ((ev.clientX - r.left) / r.width) * length;
          }}
        >
          <Waveform levels={levels} height={56} progress={length ? time / length : 0} />
        </button>
      )}
      {error && <p className="mt-3 text-[14px] text-ember">{error}</p>}
      <p className="mt-3 text-[13px] text-zinc">Stereo recording from AssemblyAI. Vendor on the left channel, agent on the right.</p>
    </div>
  );
}
