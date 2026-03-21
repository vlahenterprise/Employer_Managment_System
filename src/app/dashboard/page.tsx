import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import UserMenu from "./UserMenu";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowRight, IconCalendar, IconReport, IconSettings, IconSparkles, IconTasks, IconUsers } from "@/components/icons";

export default async function DashboardPage() {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const t = getI18n(lang);
  const hasHrAccess = user.role === "ADMIN" || user.role === "HR" || user.hrAddon;
  const hasManagementPanel = user.role === "ADMIN" || user.role === "MANAGER";

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div className="brand">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="brand-logo" src={branding.logoUrl} alt={branding.title} />
              ) : null}
              <div>
                <h1 className="brand-title">{branding.title}</h1>
                <p className="muted">{branding.subtitle}</p>
              </div>
            </div>

            <div>
              <h2 className="h2">{t.dashboard.title}</h2>
              <p className="muted">{t.dashboard.chooseModule}</p>
            </div>
          </div>

          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        <div className="module-grid" role="list">
          <Link className="module-tile module-primary" href="/reports" role="listitem">
            <span className="module-icon" aria-hidden="true">
              <IconReport size={24} />
            </span>
            <span className="module-body">
              <span className="module-title">{t.dashboard.dailyReport}</span>
              <span className="module-subtitle">{t.dashboard.dailyReportDesc}</span>
            </span>
            <span className="module-cta" aria-hidden="true">
              <IconArrowRight size={18} />
            </span>
          </Link>

          <Link className="module-tile module-tasks" href="/tasks" role="listitem">
            <span className="module-icon" aria-hidden="true">
              <IconTasks size={24} />
            </span>
            <span className="module-body">
              <span className="module-title">{t.dashboard.tasks}</span>
              <span className="module-subtitle">{t.dashboard.tasksDesc}</span>
            </span>
            <span className="module-cta" aria-hidden="true">
              <IconArrowRight size={18} />
            </span>
          </Link>

          <Link className="module-tile module-absence" href="/absence" role="listitem">
            <span className="module-icon" aria-hidden="true">
              <IconCalendar size={24} />
            </span>
            <span className="module-body">
              <span className="module-title">{t.dashboard.absence}</span>
              <span className="module-subtitle">{t.dashboard.absenceDesc}</span>
            </span>
            <span className="module-cta" aria-hidden="true">
              <IconArrowRight size={18} />
            </span>
          </Link>

          <Link className="module-tile module-performance" href="/performance" role="listitem">
            <span className="module-icon" aria-hidden="true">
              <IconSparkles size={24} />
            </span>
            <span className="module-body">
              <span className="module-title">{t.dashboard.performance}</span>
              <span className="module-subtitle">{t.dashboard.performanceDesc}</span>
            </span>
            <span className="module-cta" aria-hidden="true">
              <IconArrowRight size={18} />
            </span>
          </Link>

          <Link className="module-tile module-admin" href="/organization" role="listitem">
            <span className="module-icon" aria-hidden="true">
              <IconUsers size={24} />
            </span>
            <span className="module-body">
              <span className="module-title">{t.dashboard.orgChart}</span>
              <span className="module-subtitle">{t.dashboard.orgChartDesc}</span>
            </span>
            <span className="module-cta" aria-hidden="true">
              <IconArrowRight size={18} />
            </span>
          </Link>

          {hasHrAccess ? (
            <Link className="module-tile module-admin" href="/hr" role="listitem">
              <span className="module-icon" aria-hidden="true">
                <IconUsers size={24} />
              </span>
              <span className="module-body">
                <span className="module-title">HR System</span>
                <span className="module-subtitle">
                  {lang === "sr"
                    ? "Otvorene pozicije, kandidati, CV baza i HR tok."
                    : "Open positions, candidates, CV base and HR workflow."}
                </span>
              </span>
              <span className="module-cta" aria-hidden="true">
                <IconArrowRight size={18} />
              </span>
            </Link>
          ) : null}

          {hasManagementPanel ? (
            <Link className="module-tile module-admin" href="/management" role="listitem">
              <span className="module-icon" aria-hidden="true">
                <IconTasks size={24} />
              </span>
              <span className="module-body">
                <span className="module-title">Management Panel</span>
                <span className="module-subtitle">
                  {lang === "sr"
                    ? "Metrike tima, odobrenja i pregled aktivnih procesa."
                    : "Team metrics, approvals and active workflow overview."}
                </span>
              </span>
              <span className="module-cta" aria-hidden="true">
                <IconArrowRight size={18} />
              </span>
            </Link>
          ) : null}

          {user.role === "ADMIN" || user.role === "HR" ? (
            <Link className="module-tile module-admin" href="/reports/manager" role="listitem">
              <span className="module-icon" aria-hidden="true">
                <IconUsers size={24} />
              </span>
              <span className="module-body">
                <span className="module-title">{t.dashboard.reportingManager}</span>
                <span className="module-subtitle">{t.dashboard.reportingManagerDesc}</span>
              </span>
              <span className="module-cta" aria-hidden="true">
                <IconArrowRight size={18} />
              </span>
            </Link>
          ) : null}

          {user.role === "ADMIN" ? (
            <Link className="module-tile module-admin" href="/admin/users" role="listitem">
              <span className="module-icon" aria-hidden="true">
                <IconSettings size={24} />
              </span>
              <span className="module-body">
                <span className="module-title">{t.dashboard.adminPanel}</span>
                <span className="module-subtitle">{t.dashboard.adminPanelDesc}</span>
              </span>
              <span className="module-cta" aria-hidden="true">
                <IconArrowRight size={18} />
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
