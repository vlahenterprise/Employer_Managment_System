import type { ReactNode } from "react";
import Link from "next/link";
import { getBrandingSettings } from "@/server/settings";
import { getI18n, type Lang } from "@/i18n";
import UserMenu from "@/app/dashboard/UserMenu";
import { IconArrowLeft } from "@/components/icons";

export type AdminTabKey =
  | "users"
  | "teams"
  | "org"
  | "activityTypes"
  | "settings"
  | "performanceQuestions"
  | "import"
  | "backup";

type AdminShellProps = {
  user: {
    name: string;
    email: string;
    role: string;
    hrAddon?: boolean | null;
    adminAddon?: boolean | null;
    position?: string | null;
    team?: { name: string } | null;
  };
  lang: Lang;
  title: string;
  subtitle: string;
  activeTab: AdminTabKey;
  children: ReactNode;
  success?: string | null;
  error?: string | null;
  actions?: ReactNode;
  note?: string | null;
};

const TAB_ORDER: AdminTabKey[] = [
  "users",
  "teams",
  "org",
  "activityTypes",
  "settings",
  "performanceQuestions",
  "import",
  "backup"
];

const TAB_HREF: Record<AdminTabKey, string> = {
  users: "/admin/users",
  teams: "/admin/teams",
  org: "/admin/org-structure",
  activityTypes: "/admin/activity-types",
  settings: "/admin/settings",
  performanceQuestions: "/admin/performance-questions",
  import: "/admin/import",
  backup: "/admin/backup"
};

function getAdminNote(lang: Lang) {
  if (lang === "sr") {
    return {
      eyebrow: "Admin kontrola",
      note:
        "Ovde upravljaš pristupima, podešavanjima i sistemskim definicijama. Promene su grupisane po nameni kako bi bile pregledne i sigurne."
    };
  }

  return {
    eyebrow: "Admin controls",
    note:
      "Manage access, settings, and system definitions here. Changes are grouped by purpose so this area stays clear and safe to use."
  };
}

export default async function AdminShell({
  user,
  lang,
  title,
  subtitle,
  activeTab,
  children,
  success,
  error,
  actions,
  note
}: AdminShellProps) {
  const branding = await getBrandingSettings();
  const t = getI18n(lang);
  const shellCopy = getAdminNote(lang);

  return (
    <main className="page">
      <div className="card stack admin-shell">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div className="header">
              <div className="brand">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="brand-logo" src={branding.logoUrl} alt={branding.title} />
                ) : null}
                <div className="stack admin-shell-copy">
                  <span className="pill pill-blue admin-shell-eyebrow">{shellCopy.eyebrow}</span>
                  <div>
                    <h1 className="brand-title">{title}</h1>
                    <p className="muted">{subtitle}</p>
                  </div>
                </div>
              </div>
              <div className="inline">
                {actions}
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
              </div>
            </div>

            <div className="notice notice-info admin-shell-note">
              <div className="notice-icon">⚙️</div>
              <div className="stack">
                <div className="notice-title">{shellCopy.eyebrow}</div>
                <div className="muted small">{note || shellCopy.note}</div>
              </div>
            </div>

            <div className="tabs admin-tabs">
              {TAB_ORDER.map((tabKey) => (
                <Link
                  key={tabKey}
                  className={`tab${tabKey === activeTab ? " tab-active" : ""}`}
                  href={TAB_HREF[tabKey]}
                >
                  {t.admin.tabs[tabKey]}
                </Link>
              ))}
            </div>
          </div>

          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            hrAddon={user.hrAddon ?? undefined}
            adminAddon={user.adminAddon ?? undefined}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {children}
      </div>
    </main>
  );
}
