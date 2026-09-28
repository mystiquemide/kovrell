"use client";

import { useState } from "react";
import { copyText } from "@/lib/copy";

/** Small copy control for code samples. Confirms right away and announces it to screen readers. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        copyText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-[8px] border border-line bg-canvas px-2.5 py-1 font-display text-[13px] font-medium text-ink hover:border-line-strong"
      aria-live="polite"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
