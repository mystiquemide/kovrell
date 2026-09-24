export type StampKind = "HELD" | "VERIFIED" | "BLOCKED" | "LOCKED" | "INCONCLUSIVE" | "LIVE" | "RINGING";

const STYLE: Record<StampKind, string> = {
  VERIFIED: "border-mint text-mint",
  BLOCKED: "border-ember text-ember",
  HELD: "border-steel text-cream",
  LIVE: "border-cream text-cream",
  RINGING: "border-steel text-cream",
  LOCKED: "border-steel text-mercury",
  INCONCLUSIVE: "border-steel text-mercury",
};

export function Stamp({ kind, large = false }: { kind: StampKind; large?: boolean }) {
  return (
    <span
      className={`label inline-flex items-center rounded-[5.6px] border whitespace-nowrap ${STYLE[kind]} ${
        large ? "px-4 py-2 text-[14px]" : "px-2.5 py-1"
      }`}
    >
      {kind}
    </span>
  );
}

/** Maps stored request and run states to the stamp a person should see. */
export function requestStamp(status: string, locked = false): StampKind {
  if (status === "verified") return "VERIFIED";
  if (status === "blocked") return "BLOCKED";
  return locked ? "LOCKED" : "HELD";
}

export function verdictStamp(verdict: string | null, status: string): StampKind {
  if (verdict === "PASS") return "VERIFIED";
  if (verdict === "FAIL") return "BLOCKED";
  if (verdict === "INCONCLUSIVE") return "INCONCLUSIVE";
  return status === "live" ? "LIVE" : "RINGING";
}
