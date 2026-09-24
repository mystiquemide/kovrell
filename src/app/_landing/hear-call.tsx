"use client";

import { useEffect, useRef, useState } from "react";
import { PRIMARY } from "@/components/button";
import { Waveform } from "@/components/waveform";

/** Plays a real recorded verification call, with the waveform of that same call. */
export function HearCall({ runId, levels }: { runId: string | null; levels: number[] }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  return (
    <div>
      {runId && <audio ref={audio} src={`/api/runs/${runId}/audio`} preload="none" />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          disabled={!runId}
          className={PRIMARY}
          onClick={() => {
            const a = audio.current;
            if (!a) return;
            if (playing) {
              a.pause();
              setPlaying(false);
            } else {
              a.play()
                .then(() => setPlaying(true))
                .catch(() => setError("The recording could not play."));
            }
          }}
        >
          {playing ? "Pause the call" : "Hear a verification call"}
        </button>
        {!runId && <span className="text-[14px] text-mercury">A recording appears here after the first completed run.</span>}
        {error && <span className="text-[14px] text-ember">{error}</span>}
      </div>
      {levels.length > 0 && <Waveform levels={levels} height={72} progress={playing || progress > 0 ? progress : undefined} className="mt-12 overflow-hidden" />}
    </div>
  );
}
