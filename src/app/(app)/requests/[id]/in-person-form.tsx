"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SECONDARY } from "@/components/button";

const FIELD = "mt-1.5 h-10 w-full rounded-[10px] border border-line bg-canvas px-3 text-[15px] text-ink outline-none focus:border-line-strong";
const LABEL = "block text-[14px] text-muted";

/** Records a verification done outside Kovrell's call. Shown only when Kovrell can't call, or its call had no verdict. */
export function InPersonForm({ requestId, reason }: { requestId: string; reason: "locked" | "inconclusive" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ verified_by: "", method: "in_person", confirm_last4: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const res = await fetch(`/api/requests/${requestId}/manual`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, note: form.note.trim() || undefined }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      setErrors(body.fields ? Object.values(body.fields) : [body.error ?? "The verification couldn't be recorded. Nothing was changed. Try again."]);
      setBusy(false);
      return;
    }
    router.push(`/evidence/${body.run.id}`);
  }

  return (
    <section className="mt-10 rounded-[12px] border border-line bg-panel p-6">
      <p className="label text-subtle">Verified another way?</p>
      <p className="mt-3 max-w-2xl text-muted">
        {reason === "locked"
          ? "Kovrell won't call this number. If someone on your team confirmed the change with the vendor in person, on video, or on a number you already trust, record it here."
          : "The last call ended without a verdict. If someone on your team has since confirmed the change with the vendor another way, record it here."}
      </p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={`${SECONDARY} mt-5`}>
          Record an in-person verification
        </button>
      ) : (
        <form onSubmit={submit} className="mt-6 grid max-w-2xl gap-5 sm:grid-cols-2">
          <label className={LABEL}>
            Verified by
            <input className={FIELD} value={form.verified_by} onChange={(e) => setForm({ ...form, verified_by: e.target.value })} required autoFocus />
          </label>
          <label className={LABEL}>
            How
            <select className={FIELD} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="in_person">In person</option>
              <option value="video_call">Video call</option>
              <option value="known_number">A number AP already trusts</option>
            </select>
          </label>
          <label className={LABEL}>
            New account ending, as the vendor confirmed it
            <input
              className={`${FIELD} data`}
              inputMode="numeric"
              maxLength={4}
              value={form.confirm_last4}
              onChange={(e) => setForm({ ...form, confirm_last4: e.target.value.replace(/\D/g, "") })}
              required
            />
          </label>
          <label className={LABEL}>
            Note (optional)
            <input className={FIELD} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={busy} className={SECONDARY}>
              {busy ? "Recording" : "Record verification and release payment"}
            </button>
            <p className="text-[14px] text-muted">It&apos;s sealed into an evidence record with who confirmed it and how.</p>
          </div>
          <div role="alert" aria-live="assertive" className="sm:col-span-2">
            {errors.length > 0 && (
              <ul className="list-disc rounded-[10px] border border-fail/40 px-8 py-3 text-[14px] text-fail">
                {errors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
