"use client";

import { SECONDARY } from "@/components/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-xl">
      <p className="label text-ember">Something went wrong</p>
      <h1 className="heading mt-3 text-[32px]">This page could not load from the ledger.</h1>
      <p className="mt-3 text-mercury">Nothing was changed. Payments stay held until a verification run completes.</p>
      <button onClick={reset} className={`${SECONDARY} mt-8`}>
        Try again
      </button>
    </div>
  );
}
