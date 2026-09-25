import Link from "next/link";
import type { ComponentProps } from "react";

const BASE =
  "inline-flex h-10 items-center justify-center gap-2 px-4 font-tight text-[15px] font-medium tracking-[-0.01em] transition-colors disabled:cursor-not-allowed";
/** Solid ink button: black on light surfaces, cream on dark ones. */
export const PRIMARY = `${BASE} rounded-full bg-ink text-canvas hover:opacity-85 disabled:bg-chip disabled:text-subtle`;
/** Quiet chip button, like the reference's Login control. */
export const SECONDARY = `${BASE} rounded-full border border-line-strong bg-canvas text-ink hover:bg-panel disabled:text-subtle`;

export function Arrow() {
  return <span aria-hidden="true">&rarr;</span>;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  return <Link {...props} className={`${variant === "primary" ? PRIMARY : SECONDARY} ${className}`} />;
}
