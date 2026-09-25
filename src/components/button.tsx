import Link from "next/link";
import type { ComponentProps } from "react";

const BASE =
  "inline-flex h-10 items-center justify-center gap-2 px-4 font-display text-[15px] font-medium tracking-[-0.01em] transition-colors disabled:cursor-not-allowed";
/** Solid ink button: black on light surfaces, cream on dark ones. */
export const PRIMARY = `${BASE} rounded-[12px] bg-ink text-canvas hover:opacity-85 disabled:bg-chip disabled:text-subtle`;
/** Quiet chip button, like the reference's Login control. */
export const SECONDARY = `${BASE} rounded-[12px] bg-chip text-ink hover:bg-line disabled:text-subtle`;
/** Hero pair on photography: white block and black block. */
export const ON_PHOTO_LIGHT = `${BASE} rounded-[4px] bg-white text-black hover:bg-white/85`;
export const ON_PHOTO_DARK = `${BASE} rounded-[12px] border border-white/15 bg-black text-[#fafafa] hover:bg-black/80`;

export function Arrow() {
  return <span aria-hidden="true">&rarr;</span>;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  return <Link {...props} className={`${variant === "primary" ? PRIMARY : SECONDARY} ${className}`} />;
}
