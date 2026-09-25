"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SECONDARY } from "./button";

/** Restores the sample ledger so the next visitor can run a verification. */
export function ResetLedger() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/reset", { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) {
      setMessage(body.error ?? "Could not reset the ledger.");
      return;
    }
    setMessage("Ledger reset. Every request is held again.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={reset} disabled={busy} className={SECONDARY}>
        {busy ? "Resetting" : "Reset the sample ledger"}
      </button>
      {message && <span className="text-[14px] text-muted">{message}</span>}
    </div>
  );
}
