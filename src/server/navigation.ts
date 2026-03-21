import "server-only";

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
};

export function getPrimaryNavigation(actor: NavigationActor) {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Home", match: ["/dashboard"] }
  ];

  if (isManagerRole(actor.role)) {
    items.push(
      { href: "/team", label: "Team", match: ["/team"] },
      { href: "/tasks", label: "Tasks", match: ["/tasks"] },
      { href: "/reports/manager", label: "Daily Reports", shortLabel: "Reports", match: ["/reports", "/reports/manager"] },
      { href: "/absence", label: "Absence", match: ["/absence"] },
      { href: "/performance", label: "Performance", match: ["/performance"] },
      { href: "/management", label: "Hiring", match: ["/management"] }
    );
  } else {
    items.push(
      { href: "/tasks", label: "My Tasks", shortLabel: "Tasks", match: ["/tasks"] },
      { href: "/reports", label: "Daily Reports", shortLabel: "Reports", match: ["/reports"] },
      { href: "/absence", label: "Absence", match: ["/absence"] },
      { href: "/performance", label: "Performance", match: ["/performance"] }
    );
  }

  items.push(
    { href: "/profile", label: "My Profile", shortLabel: "Profile", match: ["/profile"] },
    { href: "/inbox", label: "Inbox", match: ["/inbox"] }
  );

  if (hasHrAddon(actor)) {
    items.push(
      { href: "/hr", label: "HR System", shortLabel: "HR", match: ["/hr"] },
      { href: "/candidates", label: "Candidates", match: ["/candidates"] },
      { href: "/talent-pool", label: "Talent Pool", shortLabel: "Pool", match: ["/talent-pool"] },
      { href: "/onboarding", label: "Onboarding", match: ["/onboarding"] }
    );
  }

  if (hasAccessAdmin(actor)) {
    items.push(
      { href: "/admin/settings", label: "Settings", match: ["/admin/settings", "/admin/backup", "/admin/import", "/admin/performance-questions", "/admin/activity-types"] },
      { href: "/access", label: "Access", match: ["/access", "/admin", "/admin/users", "/admin/teams", "/admin/org-structure"] }
    );
  }

  return items;
}
