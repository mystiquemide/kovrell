/** Shown while a ledger page renders: the page's shape with a clear label, not a blank screen. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="label text-subtle">Loading…</p>
      <div className="mt-4 h-10 w-[min(420px,80%)] animate-pulse rounded-[8px] bg-chip" />
      <div className="mt-12 border-t border-line">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-6 border-b border-line py-5">
            <div className="flex-1">
              <div className="h-4 w-40 animate-pulse rounded bg-chip" />
              <div className="mt-2 h-3 w-56 animate-pulse rounded bg-chip" />
            </div>
            <div className="h-4 w-24 animate-pulse rounded bg-chip" />
            <div className="h-6 w-20 animate-pulse rounded bg-chip" />
          </div>
        ))}
      </div>
    </div>
  );
}
