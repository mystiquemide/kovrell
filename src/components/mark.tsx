/** Kovrell mark: a hold bracket with one bar. The bar turns into a check when a run verifies. */
export function Mark({ size = 22, verified = false }: { size?: number; verified?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 3H3v14h3M14 3h3v14h-3" stroke="currentColor" strokeWidth="1.6" />
      {verified ? (
        <path d="M6.5 10.2l2.4 2.4 4.6-5" stroke="var(--k-pass)" strokeWidth="1.6" />
      ) : (
        <path d="M6.5 10h7" stroke="currentColor" strokeWidth="1.6" />
      )}
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <Mark />
      <span className="font-display text-[19px] font-semibold tracking-[0.14em]">KOVRELL</span>
    </span>
  );
}
