"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const LINKS = [
  { href: "/", label: "داشبورد" },
  { href: "/planner", label: "برنامهٔ روزانه" },
  { href: "/goals", label: "هدف‌ها" },
  { href: "/stats", label: "آمار و پیشرفت" },
] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="بخش‌های اصلی" className="-mx-1 flex gap-1 overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
