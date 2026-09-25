"use client";

import type { ComponentProps } from "react";

/** In-page link that scrolls to a section without adding a #fragment to the address bar. */
export function ScrollLink({ to, onClick, ...props }: Omit<ComponentProps<"a">, "href"> & { to: string }) {
  return (
    <a
      {...props}
      href={`#${to}`}
      onClick={(e) => {
        onClick?.(e);
        const target = document.getElementById(to);
        if (!target) return;
        e.preventDefault();
        const nav = document.querySelector("header");
        const top = target.getBoundingClientRect().top + window.scrollY - (nav?.getBoundingClientRect().height ?? 0);
        window.scrollTo({ top, behavior: "smooth" });
      }}
    />
  );
}
