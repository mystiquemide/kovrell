"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Arrow, PRIMARY } from "@/components/button";

/** Starts a verification run, then opens the live call screen. */
export function CallButton({
  requestId,
  contactName,
  disabledReason,
  label = "Call vendor of record",
}: {
  requestId: string;
  contactName: string;
  disabledReason: string | null;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/requests/${requestId}/runs`, { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      setError(body.error ?? "Could not start the verification run. Nothing was changed.");
      setBusy(false);
      return;
    }
    router.push(`/calls/${body.run.id}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button onClick={start} disabled={busy || Boolean(disabledReason)} className={PRIMARY}>
          {busy ? "Starting run" : label} {!busy && <Arrow />}
        </button>
        <p className={`text-[14px] ${disabledReason ? "text-ember" : "text-mercury"}`}>
          {disabledReason ?? `Rings ${contactName} on a secure call link.`}
        </p>
      </div>
      {error && <p className="mt-3 text-[14px] text-ember">{error}</p>}
    </div>
  );
}
