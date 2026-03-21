"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/server/navigation";
import {
  IconBriefcase,
  IconCalendar,
  IconCheckCircle,
  IconHome,
  IconInbox,
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

  const isActive = (item: NavItem) => {
    const matches = item.match?.length ? item.match : [item.href];
    return matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  };

  const groupLabels = {
    work: lang === "sr" ? "Rad" : "Work",
    personal: lang === "sr" ? "Lično" : "Personal",
    hr: "HR",
    admin: "Admin"
  } as const;

  let previousGroup: NavItem["group"] | null = null;

  return (
    <div className="app-nav-shell">
      <div className="app-nav-brand">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={title} className="app-nav-logo" />
        ) : null}
        <div className="app-nav-brand-copy">
          <span className="app-nav-brand-title">{title}</span>
          <span className="app-nav-brand-sub">{lang === "sr" ? "Employer sistem" : "Employer Management"}</span>
          {accessBadges?.length ? (
            <div className="app-nav-brand-meta">
              {accessBadges.map((badge) => (
                <span key={badge} className="app-nav-badge">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <nav className="app-nav" aria-label="Primary">
        {items.map((item) => {
          const showGroup = item.group && item.group !== previousGroup;
          previousGroup = item.group || previousGroup;
          const Icon = navIconByHref[item.href as keyof typeof navIconByHref] ?? IconSparkles;
          return (
            <div key={item.href} className="app-nav-item">
              {showGroup ? (
                <div className="app-nav-group-label" aria-hidden="true">
                  {groupLabels[item.group!]}
                </div>
              ) : null}
              <Link
                href={item.href}
                className={`app-nav-link${isActive(item) ? " app-nav-link-active" : ""}`}
              >
                <span className="app-nav-link-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="app-nav-link-copy">
                  <span className="app-nav-link-full">{item.label}</span>
                  <span className="app-nav-link-short">{item.shortLabel || item.label}</span>
                </span>
              </Link>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
