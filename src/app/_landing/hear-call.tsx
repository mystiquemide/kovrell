"use client";

import { useEffect, useRef, useState } from "react";
import { PRIMARY } from "@/components/button";
import { Waveform } from "@/components/waveform";
import { clock } from "@/lib/format";

/** Plays the recorded showcase run over the waveform drawn from that same call. */
export function HearCall({ src, levels, caption }: { src: string; levels: number[]; caption: string }) {
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

  function toggle() {
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
  }

  return (
    <div id="hear">
      <audio ref={audio} src={src} preload="metadata" />
      <button onClick={toggle} className={PRIMARY}>
        {playing ? "Pause the call" : "Hear a verification call"}
      </button>
      <button
        className="mt-12 block w-full overflow-hidden text-left"
        aria-label="Seek the recording"
        onClick={(ev) => {
          const a = audio.current;
          if (!a || !length) return;
          const r = ev.currentTarget.getBoundingClientRect();
          a.currentTime = ((ev.clientX - r.left) / r.width) * length;
          if (!playing) toggle();
        }}
      >
        <Waveform levels={levels} height={72} progress={time > 0 && length ? time / length : undefined} />
      </button>
      <p className="label mt-4 text-zinc">
        {time > 0 && length ? `${clock(time * 1000)} / ${clock(length * 1000)}  ` : ""}
        {caption}
      </p>
      {error && <p className="mt-2 text-[14px] text-ember">{error}</p>}
    </div>
  );
}
