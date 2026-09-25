"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./mark";

const LINKS = [
  { href: "/requests", label: "Requests", match: ["/requests", "/calls"] },
  { href: "/vendors", label: "Vendors", match: ["/vendors"] },
  { href: "/evidence", label: "Evidence", match: ["/evidence"] },
];

export function Nav({ company }: { company: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" aria-label="Kovrell home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-5 sm:gap-9">
          {LINKS.map((l) => {
            const active = l.match.some((m) => path.startsWith(m));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`font-tight text-[15px] font-medium transition-colors ${active ? "text-ink" : "text-subtle hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <span className="hidden h-10 items-center rounded-full border border-line px-4 font-tight text-[15px] font-medium text-ink md:inline-flex">{company}</span>
      </div>
    </header>
  );
}
