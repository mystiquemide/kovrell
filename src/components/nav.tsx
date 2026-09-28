"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark, Wordmark } from "./mark";

const LINKS = [
  { href: "/", label: "Home", match: [] as string[] },
  { href: "/requests", label: "Requests", match: ["/requests", "/calls"] },
  { href: "/setup", label: "Set up", match: ["/setup"] },
  { href: "/vendors", label: "Vendors", match: ["/vendors"] },
  { href: "/evidence", label: "Evidence", match: ["/evidence"] },
];

/** `company` is the visitor's company from Set up. Without one, the nav invites them to set it. */
export function Nav({ company }: { company: string | null }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" aria-label="Kovrell home" className="shrink-0">
          <span className="hidden sm:inline">
            <Wordmark />
          </span>
          <span className="text-ink sm:hidden">
            <Mark size={24} />
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-9">
          {LINKS.map((l) => {
            const active = l.match.some((m) => path.startsWith(m));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap font-display text-[15px] font-medium transition-colors ${active ? "text-ink" : "text-subtle hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        {company ? (
          <span className="hidden h-10 items-center rounded-[12px] bg-chip px-4 font-display text-[15px] font-medium text-ink md:inline-flex">{company} AP</span>
        ) : (
          <Link
            href="/setup"
            className="hidden h-10 items-center rounded-[12px] bg-chip px-4 font-display text-[15px] font-medium text-ink hover:bg-line md:inline-flex"
          >
            Set your company
          </Link>
        )}
      </div>
    </header>
  );
}
