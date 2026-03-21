"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/server/navigation";

export default function AppNavigation({
  items,
  title,
  logoUrl
}: {
  items: NavItem[];
  title: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    const matches = item.match?.length ? item.match : [item.href];
    return matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  };

  return (
    <div className="app-nav-shell">
      <div className="app-nav-brand">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={title} className="app-nav-logo" />
        ) : null}
        <div className="app-nav-brand-copy">
          <span className="app-nav-brand-title">{title}</span>
          <span className="app-nav-brand-sub">Employer Management</span>
        </div>
      </div>

      <nav className="app-nav" aria-label="Primary">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`app-nav-link${isActive(item) ? " app-nav-link-active" : ""}`}
          >
            <span className="app-nav-link-full">{item.label}</span>
            <span className="app-nav-link-short">{item.shortLabel || item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
