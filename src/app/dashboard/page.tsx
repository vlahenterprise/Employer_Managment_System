import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import UserMenu from "./UserMenu";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowRight, IconCalendar, IconCheckCircle, IconReport, IconSettings, IconSparkles, IconTasks, IconUsers } from "@/components/icons";
import { getHomeDashboard } from "@/server/home";
import { hasAccessAdmin, hasHrAddon, isManagerRole } from "@/server/rbac";

export default async function DashboardPage() {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const t = getI18n(lang);
  const home = await getHomeDashboard({
    id: user.id,
    email: user.email,
    role: user.role,
    hrAddon: user.hrAddon,
    adminAddon: user.adminAddon,
    teamId: user.teamId
  });
  const hasHrAccess = hasHrAddon(user);
  const hasManagementPanel = isManagerRole(user.role);
  const hasAdminAccess = hasAccessAdmin(user);
  const inboxPreview = home.summary.inbox.needsMyAction.slice(0, 4);

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
            hrAddon={user.hrAddon}
            adminAddon={user.adminAddon}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        <section className="panel stack">
          <div className="grid4 dashboard-summary-grid">
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconTasks size={18} /></div>
              <div>
                <div className="kpi-value">{home.summary.todayTaskCount}</div>
                <div className="kpi-label">Today tasks</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconCalendar size={18} /></div>
              <div>
                <div className="kpi-value">{home.summary.overdueTaskCount}</div>
                <div className="kpi-label">Overdue</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconReport size={18} /></div>
              <div>
                <div className="kpi-value">{home.summary.todayReport ? "Done" : "Missing"}</div>
                <div className="kpi-label">Today report</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconCheckCircle size={18} /></div>
              <div>
                <div className="kpi-value">{home.summary.inbox.totals.needsMyAction}</div>
                <div className="kpi-label">Needs my action</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid2 dashboard-home-grid">
          <section className="panel stack">
            <div className="item-top">
              <h2 className="h2">Action Center</h2>
              <Link className="button button-secondary" href="/inbox">
                Inbox <IconArrowRight size={18} />
              </Link>
            </div>
            <div className="list">
              {inboxPreview.map((item) => (
                <div key={item.id} className="item item-compact">
                  <div>
                    <div className="item-title">{item.title}</div>
                    <div className="muted small">{item.description}</div>
                  </div>
                  <Link className="button button-secondary" href={item.href}>
                    Open
                  </Link>
                </div>
              ))}
              {inboxPreview.length === 0 ? <div className="muted small">No urgent actions right now.</div> : null}
            </div>
          </section>

          <section className="panel stack">
            <h2 className="h2">Quick visibility</h2>
            <div className="detail-list">
              <div><strong>Absence summary:</strong> {home.summary.remaining.annualRemaining} annual · {home.summary.remaining.homeOfficeRemaining} home office</div>
              <div><strong>Team absent today:</strong> {home.summary.teamAbsencesToday.length}</div>
              <div><strong>Active onboarding:</strong> {home.summary.activeOnboarding?.status || "—"}</div>
              {hasManagementPanel ? <div><strong>Open hiring requests:</strong> {home.summary.teamOpenHiring}</div> : null}
              {hasManagementPanel ? <div><strong>Missing team reports today:</strong> {home.summary.missingReports.length}</div> : null}
              {hasHrAccess ? <div><strong>Approved hiring requests ready for HR:</strong> {home.summary.hrApprovedRequests}</div> : null}
              {hasHrAccess ? <div><strong>Candidates waiting round 2 / final round:</strong> {home.summary.hrRoundTwo} / {home.summary.hrFinalRound}</div> : null}
              {hasAdminAccess ? <div><strong>Admin shortcuts:</strong> Settings and Access are available in the nav.</div> : null}
            </div>
          </section>
        </div>

        <div className="module-grid" role="list">
          <Link className="module-tile module-primary" href={hasManagementPanel ? "/reports/manager" : "/reports"} role="listitem">
            <span className="module-icon" aria-hidden="true">
              <IconReport size={24} />
            </span>
            <span className="module-body">
              <span className="module-title">{hasManagementPanel ? t.dashboard.reportingManager : t.dashboard.dailyReport}</span>
              <span className="module-subtitle">{hasManagementPanel ? t.dashboard.reportingManagerDesc : t.dashboard.dailyReportDesc}</span>
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

          {hasManagementPanel ? (
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

          {hasAdminAccess ? (
            <Link className="module-tile module-admin" href="/access" role="listitem">
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

          {hasAdminAccess ? (
            <Link className="module-tile module-admin" href="/admin/settings" role="listitem">
              <span className="module-icon" aria-hidden="true">
                <IconSettings size={24} />
              </span>
              <span className="module-body">
                <span className="module-title">Settings</span>
                <span className="module-subtitle">
                  {lang === "sr"
                    ? "Sistemska podešavanja, rečnici i podrazumevane vrednosti."
                    : "System settings, dictionaries, and default values."}
                </span>
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
