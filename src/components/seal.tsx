"use client";

import { useState } from "react";
import { copyText } from "@/lib/copy";
import { VERIFY_CMD } from "@/lib/verify";

/** Shows a sha256 seal short by default, with copy, expand, and a way to check it yourself. */
export function Seal({ hash, downloadHref }: { hash: string; downloadHref: string }) {
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState<"hash" | "cmd" | null>(null);
  const [howTo, setHowTo] = useState(false);

  function copy(text: string, what: "hash" | "cmd") {
    copyText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="label text-subtle">sha256</span>
        <code className={`data text-[13px] text-ink ${full ? "break-all" : ""}`}>{full ? hash : `${hash.slice(0, 12)}...${hash.slice(-8)}`}</code>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => copy(hash, "hash")} className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-ink hover:bg-chip">
          <span aria-live="polite">{copied === "hash" ? "Copied" : "Copy hash"}</span>
        </button>
        <button onClick={() => setFull(!full)} className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-ink hover:bg-chip">
          {full ? "Shorten" : "Show full hash"}
        </button>
        <button onClick={() => setHowTo(!howTo)} className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-ink hover:bg-chip" aria-expanded={howTo}>
          How to verify
        </button>
      </div>
      {howTo && (
        <div className="mt-4 rounded-[10px] border border-line bg-panel p-4 text-[14px] text-muted">
          <p>
            1.{" "}
            <a href={downloadHref} download="kovrell-record.json" className="text-ink underline underline-offset-4">
              Download the sealed record
            </a>{" "}
            as <code className="data text-ink">kovrell-record.json</code>.
          </p>
          <p className="mt-1.5">2. Run this. It hashes the record the same way Kovrell sealed it and prints True when the seal matches.</p>
          <pre className="data mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-[8px] border border-line bg-canvas p-3 text-[12px] text-ink">{VERIFY_CMD}</pre>
          <button onClick={() => copy(VERIFY_CMD, "cmd")} className="mt-2 rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-ink hover:bg-chip">
            {copied === "cmd" ? "Copied" : "Copy command"}
          </button>
          <p className="mt-3 text-[13px] text-subtle">Change one character in the record and it prints False.</p>
        </div>
      )}
    </div>
  );
}
