import { hasAccessAdmin, hasHrAddon, isManagerRole } from "./rbac";
import type { UserRole } from "@prisma/client";

export type NavigationActor = {
  role: UserRole;
  hrAddon?: boolean;
  adminAddon?: boolean;
};

export type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  match?: string[];
  group?: "work" | "personal" | "hr" | "admin";
};

type Lang = "sr" | "en";

function navLabel(lang: Lang, sr: string, en: string) {
  return lang === "sr" ? sr : en;
}

export function getPrimaryNavigation(actor: NavigationActor, lang: Lang) {
  const items: NavItem[] = [
    { href: "/dashboard", label: navLabel(lang, "Početna", "Home"), match: ["/dashboard"], group: "work" },
    {
      href: "/organization",
      label: "ORG System",
      shortLabel: "ORG",
      match: ["/organization"],
      group: "work"
    }
  ];

  if (isManagerRole(actor.role)) {
    items.push(
      { href: "/team", label: navLabel(lang, "Tim", "Team"), match: ["/team"], group: "work" },
      { href: "/tasks", label: navLabel(lang, "Zadaci", "Tasks"), match: ["/tasks"], group: "work" },
      {
        href: "/reports/manager",
        label: navLabel(lang, "Dnevni izveštaji", "Daily Reports"),
        shortLabel: navLabel(lang, "Izveštaji", "Reports"),
        match: ["/reports", "/reports/manager"],
        group: "work"
      },
      { href: "/absence", label: navLabel(lang, "Odsustva", "Absence"), match: ["/absence"], group: "work" },
      { href: "/performance", label: "Performance", match: ["/performance"], group: "work" },
      { href: "/management", label: navLabel(lang, "Zapošljavanje", "Hiring"), match: ["/management"], group: "work" }
    );
  } else {
    items.push(
      {
        href: "/tasks",
        label: navLabel(lang, "Moji zadaci", "My Tasks"),
        shortLabel: navLabel(lang, "Zadaci", "Tasks"),
        match: ["/tasks"],
        group: "work"
      },
      {
        href: "/reports",
        label: navLabel(lang, "Dnevni izveštaji", "Daily Reports"),
        shortLabel: navLabel(lang, "Izveštaji", "Reports"),
        match: ["/reports"],
        group: "work"
      },
      { href: "/absence", label: navLabel(lang, "Odsustva", "Absence"), match: ["/absence"], group: "work" },
      { href: "/performance", label: "Performance", match: ["/performance"], group: "work" }
    );
  }

  items.push(
    {
      href: "/profile",
      label: navLabel(lang, "Moj profil", "My Profile"),
      shortLabel: navLabel(lang, "Profil", "Profile"),
      match: ["/profile"],
      group: "personal"
    },
    { href: "/inbox", label: "Inbox", match: ["/inbox"], group: "personal" }
  );

  if (hasHrAddon(actor)) {
    items.push(
      { href: "/hr", label: "HR System", shortLabel: "HR", match: ["/hr"], group: "hr" },
      { href: "/candidates", label: navLabel(lang, "Kandidati", "Candidates"), match: ["/candidates"], group: "hr" },
      { href: "/talent-pool", label: navLabel(lang, "Talent pool", "Talent Pool"), shortLabel: "Pool", match: ["/talent-pool"], group: "hr" },
      { href: "/onboarding", label: "Onboarding", match: ["/onboarding"], group: "hr" }
    );
  }

  if (hasAccessAdmin(actor)) {
    items.push(
      {
        href: "/admin/settings",
        label: navLabel(lang, "Podešavanja", "Settings"),
        match: ["/admin/settings", "/admin/backup", "/admin/import", "/admin/performance-questions", "/admin/activity-types"],
        group: "admin"
      },
      {
        href: "/access",
        label: navLabel(lang, "Pristupi", "Access"),
        match: ["/access", "/admin", "/admin/users", "/admin/teams", "/admin/org-structure"],
        group: "admin"
      }
    );
  }

  return items;
}
