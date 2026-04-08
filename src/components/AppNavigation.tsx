"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { NavItem } from "@/server/navigation";
import {
  IconArrowRight,
  IconBriefcase,
  IconCalendar,
  IconCheckCircle,
  IconClose,
  IconHome,
  IconInbox,
  IconLogout,
  IconMenu,
  IconReport,
  IconSettings,
  IconSparkles,
  IconTasks,
  IconUser,
  IconUsers
} from "@/components/icons";
import ThemeToggle from "@/components/ThemeToggle";

const navIconByHref = {
  "/dashboard": IconHome,
  "/organization": IconUsers,
  "/team": IconUsers,
  "/tasks": IconTasks,
  "/reports": IconReport,
  "/reports/manager": IconReport,
  "/absence": IconCalendar,
  "/company-calendar": IconCalendar,
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
  lang,
  user
}: {
  items: NavItem[];
  title: string;
  logoUrl?: string | null;
  lang: "sr" | "en";
  user?: { name: string; email: string; role: string; position?: string | null; team?: string | null } | null;
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
  const activeGroupKey = groupedItems
    .filter((section) => section.items.some((item) => isActive(item)))
    .map((section) => section.group)
    .join("|");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      order.map((group) => [
        group,
        group === "work" || group === "personal" || activeGroupKey.split("|").includes(group)
      ])
    )
  );

  useEffect(() => {
    const activeGroups = new Set(activeGroupKey ? activeGroupKey.split("|") : []);
    setOpenGroups((current) => {
      let changed = false;
      const next = { ...current };
      for (const group of activeGroups) {
        if (!next[group]) {
          next[group] = true;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [pathname, activeGroupKey]);

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
              <span className="app-nav-brand-sub">{lang === "sr" ? "Radni prostor" : "Workspace"}</span>
            </div>
          </div>

          <nav className="app-nav" aria-label="Primary">
            {groupedItems.map((section) => (
              <section key={section.group} className="app-nav-section">
                <button
                  type="button"
                  className={`app-nav-group-button${openGroups[section.group] ? " is-open" : ""}`}
                  aria-expanded={openGroups[section.group] ? "true" : "false"}
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [section.group]: !current[section.group]
                    }))
                  }
                >
                  <span className="app-nav-group-label">{section.label}</span>
                  <span className="app-nav-group-meta">
                    <span className="app-nav-group-count">{section.items.length}</span>
                    <span className="app-nav-group-caret" aria-hidden="true">
                      <IconArrowRight size={12} />
                    </span>
                  </span>
                </button>
                <div className={`app-nav-links${openGroups[section.group] ? " is-open" : ""}`}>
                  {section.items.map(renderNavLink)}
                </div>
              </section>
            ))}
          </nav>

          <div className="app-nav-footer">
            {user ? (
              <div className="app-nav-user">
                <div className="app-nav-user-avatar" aria-hidden="true">
                  <IconUser size={16} />
                </div>
                <div className="app-nav-user-info">
                  <div className="app-nav-user-name">{user.name}</div>
                  <div className="app-nav-user-sub">{user.email}</div>
                  {user.team ? <div className="app-nav-user-meta">{user.team}</div> : null}
                </div>
              </div>
            ) : null}
            <div className="app-nav-footer-actions">
              <ThemeToggle lang={lang} />
              <button
                type="button"
                className="button button-secondary app-nav-logout"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <IconLogout size={14} /> {lang === "sr" ? "Odjavi se" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
