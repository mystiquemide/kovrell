const COLORS = ["#4dcafa", "#de94e2", "#ffdd03", "#9977ff", "#62f6b5", "#e96b34"];

/**
 * Bars drawn from real audio levels (0 to 1). Never random: callers pass levels from a live call
 * or from a sealed run. `progress` (0 to 1) dims bars that have not played yet.
 */
export function Waveform({
  levels,
  height = 64,
  progress,
  className = "",
}: {
  levels: number[];
  height?: number;
  progress?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-[2px] ${className}`} style={{ height }} aria-hidden="true">
      {levels.map((v, i) => {
        const played = progress === undefined || i / levels.length <= progress;
        return (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-[5.6px] transition-[height] duration-100"
            style={{
              height: Math.max(3, Math.round(v * height)),
              background: COLORS[i % COLORS.length],
              opacity: played ? 1 : 0.25,
            }}
          />
        );
      })}
    </div>
  );
}
