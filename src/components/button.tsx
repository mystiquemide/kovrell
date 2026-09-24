import Link from "next/link";
import type { ComponentProps } from "react";

const BASE =
  "label inline-flex h-10 items-center justify-center gap-2 rounded-full px-6 transition-colors disabled:cursor-not-allowed";
export const PRIMARY = `${BASE} bg-cream text-void hover:bg-bone disabled:bg-slab disabled:text-zinc`;
export const SECONDARY = `${BASE} border border-steel text-cream hover:bg-iron disabled:text-zinc disabled:hover:bg-transparent`;

export function Arrow() {
  return <span aria-hidden="true">&rarr;</span>;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  return <Link {...props} className={`${variant === "primary" ? PRIMARY : SECONDARY} ${className}`} />;
}
