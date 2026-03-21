"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/server/navigation";
import {
  IconBriefcase,
  IconCalendar,
  IconCheckCircle,
  IconClose,
  IconHome,
  IconInbox,
  IconMenu,
  IconReport,
  IconSettings,
  IconSparkles,
  IconTasks,
  IconUser,
  IconUsers
} from "@/components/icons";

const navIconByHref = {
  "/dashboard": IconHome,
  "/team": IconUsers,
  "/tasks": IconTasks,
  "/reports": IconReport,
  "/reports/manager": IconReport,
  "/absence": IconCalendar,
  "/performance": IconSparkles,
  "/management": IconBriefcase,
  "/profile": IconUser,
  "/inbox": IconInbox,
  "/hr": IconBriefcase,
  "/candidates": IconUsers,
  "/talent-pool": IconSparkles,
  "/onboarding": IconCheckCircle,
  "/admin/settings": IconSettings,
  "/access": IconSettings
} as const;

export default function AppNavigation({
  items,
  title,
  logoUrl,
  accessBadges,
  lang
}: {
  items: NavItem[];
  title: string;
  logoUrl?: string | null;
  accessBadges?: string[];
  lang: "sr" | "en";
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (item: NavItem) => {
    const matches = item.match?.length ? item.match : [item.href];
    return matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  };

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const groupLabels = {
    work: lang === "sr" ? "Rad" : "Work",
    personal: lang === "sr" ? "Lično" : "Personal",
    hr: "HR",
    admin: "Admin"
  } as const;

  const order: Array<NonNullable<NavItem["group"]>> = ["work", "personal", "hr", "admin"];
  const groups = new Map<NonNullable<NavItem["group"]>, NavItem[]>();

  for (const key of order) groups.set(key, []);
  for (const item of items) {
    if (!item.group) continue;
    groups.get(item.group)?.push(item);
  }

  const groupedItems = order
    .map((group) => ({
      group,
      label: groupLabels[group],
      items: groups.get(group) ?? []
    }))
    .filter((entry) => entry.items.length > 0);

  const activeItem = items.find((item) => isActive(item));

  function renderNavLink(item: NavItem) {
    const Icon = navIconByHref[item.href as keyof typeof navIconByHref] ?? IconSparkles;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`app-nav-link${isActive(item) ? " app-nav-link-active" : ""}`}
      >
        <span className="app-nav-link-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="app-nav-link-copy">
          <span className="app-nav-link-full">{item.label}</span>
          {item.shortLabel ? <span className="app-nav-link-short">{item.shortLabel}</span> : null}
        </span>
      </Link>
    );
  }

  return (
    <>
      <div className="app-nav-mobilebar">
        <Link href="/dashboard" className="app-nav-mobile-brand">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={title} className="app-nav-mobile-logo" />
          ) : (
            <span className="app-nav-mobile-mark">VE</span>
          )}
          <span className="app-nav-mobile-copy">
            <span className="app-nav-mobile-title">{title}</span>
            <span className="app-nav-mobile-sub">{activeItem?.label || (lang === "sr" ? "Navigacija" : "Navigation")}</span>
          </span>
        </Link>
        <button
          type="button"
          className="app-nav-mobile-toggle"
          aria-label={drawerOpen ? (lang === "sr" ? "Zatvori meni" : "Close menu") : (lang === "sr" ? "Otvori meni" : "Open menu")}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((value) => !value)}
        >
          {drawerOpen ? <IconClose size={18} /> : <IconMenu size={18} />}
        </button>
      </div>

      <button
        type="button"
        className={`app-nav-overlay${drawerOpen ? " is-open" : ""}`}
        aria-label={lang === "sr" ? "Zatvori meni" : "Close menu"}
        onClick={() => setDrawerOpen(false)}
      />

      <aside className={`app-nav-shell${drawerOpen ? " is-open" : ""}`}>
        <div className="app-nav-panel">
          <div className="app-nav-brand">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={title} className="app-nav-logo" />
            ) : (
              <span className="app-nav-mobile-mark app-nav-brand-mark">VE</span>
            )}
            <div className="app-nav-brand-copy">
              <span className="app-nav-brand-title">{title}</span>
              <span className="app-nav-brand-sub">{lang === "sr" ? "Employer sistem" : "Employer Management"}</span>
            </div>
          </div>

          <nav className="app-nav" aria-label="Primary">
            {groupedItems.map((section) => (
              <section key={section.group} className="app-nav-section">
                <div className="app-nav-group-label" aria-hidden="true">
                  {section.label}
                </div>
                <div className="app-nav-links">{section.items.map(renderNavLink)}</div>
              </section>
            ))}
          </nav>

          {accessBadges?.length ? (
            <div className="app-nav-access">
              <div className="app-nav-group-label" aria-hidden="true">
                {lang === "sr" ? "Pristup" : "Access"}
              </div>
              <div className="app-nav-brand-meta">
                {accessBadges.map((badge) => (
                  <span key={badge} className="app-nav-badge">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
