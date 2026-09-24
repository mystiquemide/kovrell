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
    <header className="border-b border-iron">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Kovrell home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-5 sm:gap-8">
          {LINKS.map((l) => {
            const active = l.match.some((m) => path.startsWith(m));
            return (
              <Link key={l.href} href={l.href} className={`label transition-colors ${active ? "text-cream" : "text-zinc hover:text-cream"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <span className="label hidden rounded-[5.6px] bg-slab px-3 py-1.5 text-mercury md:inline">{company}  AP</span>
      </div>
    </header>
  );
}
