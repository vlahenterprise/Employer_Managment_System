import Link from "next/link";
import { getRequestLang } from "@/i18n/server";
import { requireActiveUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import UserMenu from "../dashboard/UserMenu";
import { getManagementPanel, hasManagementPanelAccess } from "@/server/hr";
import { markHrNotificationReadAction } from "../hr/actions";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconTasks,
  IconUsers
} from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Management Panel",
      subtitle: "Tim KPI, odobrenja, otvorene pozicije i obaveštenja.",
      noAccess: "Nemaš pristup Management Panel sekciji.",
      openPositions: "Otvorene pozicije",
      pendingReviews: "Čeka pregled menadžera",
      finalApprovals: "Čeka finalno odobrenje",
      openTasks: "Otvoreni taskovi",
      overdue: "Overdue taskovi",
      evaluations: "Aktivne evaluacije",
      absences: "Aktivna odsustva",
      notifications: "Obaveštenja",
      reviewQueue: "Kandidati za pregled",
      finalQueue: "Zahtevi za finalno odobrenje",
      activeProcesses: "Aktivni procesi",
      noData: "Nema podataka za prikaz.",
      openDetail: "Otvori detalj",
      markRead: "Označi kao pročitano",
      unread: "Nepročitano"
    };
  }

  return {
    title: "Management Panel",
    subtitle: "Team KPI, approvals, open positions and notifications.",
    noAccess: "You do not have access to the Management Panel section.",
    openPositions: "Open positions",
    pendingReviews: "Waiting manager review",
    finalApprovals: "Waiting final approval",
    openTasks: "Open tasks",
    overdue: "Overdue tasks",
    evaluations: "Active evaluations",
    absences: "Active absences",
    notifications: "Notifications",
    reviewQueue: "Candidates for review",
    finalQueue: "Final approval requests",
    activeProcesses: "Active processes",
    noData: "No data to show.",
    openDetail: "Open detail",
    markRead: "Mark as read",
    unread: "Unread"
  };
}

function statusClass(status: string) {
  const value = String(status || "").toUpperCase();
  if (["APPROVED", "CLOSED"].includes(value)) return "pill pill-status pill-status-approved";
  if (["OPEN", "IN_PROGRESS", "ON_HOLD"].includes(value)) return "pill pill-status pill-status-progress";
  if (["WAITING_MANAGER_REVIEW", "WAITING_FINAL_APPROVAL"].includes(value)) return "pill pill-status pill-status-review";
  return "pill pill-status pill-status-muted";
}

export default async function ManagementPage() {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const c = copy(lang);
  const branding = await getBrandingSettings();

  if (!hasManagementPanelAccess(user)) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{c.noAccess}</div>
        </div>
      </main>
    );
  }

  const panel = await getManagementPanel({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hrAddon: user.hrAddon,
    teamId: user.teamId,
    managerId: user.managerId
  });

  if (!panel.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{panel.error}</div>
        </div>
      </main>
    );
  }

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
                <h1 className="brand-title">{c.title}</h1>
                <p className="muted">{c.subtitle}</p>
              </div>
            </div>
            <div className="inline">
              <Link className="button button-secondary" href="/dashboard">
                <IconArrowLeft size={18} /> Dashboard
              </Link>
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

        <section className="panel stack">
          <div className="grid4 hr-metric-grid">
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconUsers size={22} /></div>
              <div><div className="kpi-value">{panel.metrics.openPositions}</div><div className="kpi-label">{c.openPositions}</div></div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconClock size={22} /></div>
              <div><div className="kpi-value">{panel.metrics.pendingManagerReviews}</div><div className="kpi-label">{c.pendingReviews}</div></div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconCheckCircle size={22} /></div>
              <div><div className="kpi-value">{panel.metrics.pendingFinalApprovals}</div><div className="kpi-label">{c.finalApprovals}</div></div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconTasks size={22} /></div>
              <div><div className="kpi-value">{panel.metrics.openTasks}</div><div className="kpi-label">{c.openTasks}</div></div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconAlertTriangle size={22} /></div>
              <div><div className="kpi-value">{panel.metrics.overdueTasks}</div><div className="kpi-label">{c.overdue}</div></div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconCalendar size={22} /></div>
              <div><div className="kpi-value">{panel.metrics.activeAbsences}</div><div className="kpi-label">{c.absences}</div></div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconUsers size={22} /></div>
              <div><div className="kpi-value">{panel.metrics.pendingEvaluations}</div><div className="kpi-label">{c.evaluations}</div></div>
            </div>
          </div>
        </section>

        <div className="grid2 hr-main-grid">
          <section className="panel stack">
            <h2 className="h2">{c.notifications}</h2>
            <div className="list">
              {panel.notifications.map((notification) => (
                <div key={notification.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{notification.title}</div>
                      <div className="muted small">{notification.body || c.noData}</div>
                    </div>
                    <span className={notification.isRead ? "pill pill-status pill-status-muted" : "pill pill-status pill-status-review"}>
                      {notification.isRead ? "Read" : c.unread}
                    </span>
                  </div>
                  <div className="inline">
                    {notification.href ? (
                      <Link className="button button-secondary" href={notification.href}>
                        {c.openDetail} <IconArrowRight size={18} />
                      </Link>
                    ) : null}
                    {!notification.isRead ? (
                      <form action={markHrNotificationReadAction}>
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <input type="hidden" name="returnTo" value="/management" />
                        <button className="button button-secondary" type="submit">
                          {c.markRead}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
              {panel.notifications.length === 0 ? <div className="muted small">{c.noData}</div> : null}
            </div>
          </section>

          <section className="panel stack">
            <h2 className="h2">{c.activeProcesses}</h2>
            <div className="list">
              {panel.processes.map((process) => (
                <div key={process.id} className="item item-compact">
                  <div>
                    <div className="item-title">{process.positionTitle}</div>
                    <div className="muted small">
                      {process.team?.name || c.noData} · {process.priority} · {process.candidates.length} candidates
                    </div>
                  </div>
                  <div className="inline">
                    <span className={statusClass(process.status)}>{process.status}</span>
                    <Link className="button button-secondary" href={`/hr/${process.id}`}>
                      {c.openDetail}
                    </Link>
                  </div>
                </div>
              ))}
              {panel.processes.length === 0 ? <div className="muted small">{c.noData}</div> : null}
            </div>
          </section>
        </div>

        <div className="grid2 hr-main-grid">
          <section className="panel stack">
            <h2 className="h2">{c.reviewQueue}</h2>
            <div className="list">
              {panel.pendingReview.map((item) => (
                <div key={item.id} className="item item-compact">
                  <div>
                    <div className="item-title">{item.candidate.fullName}</div>
                    <div className="muted small">{item.process.positionTitle} · {item.process.team?.name || c.noData}</div>
                  </div>
                  <Link className="button button-secondary" href={`/hr/${item.process.id}`}>
                    {c.openDetail}
                  </Link>
                </div>
              ))}
              {panel.pendingReview.length === 0 ? <div className="muted small">{c.noData}</div> : null}
            </div>
          </section>

          <section className="panel stack">
            <h2 className="h2">{c.finalQueue}</h2>
            <div className="list">
              {panel.finalApprovals.map((item) => (
                <div key={item.id} className="item item-compact">
                  <div>
                    <div className="item-title">{item.candidate.fullName}</div>
                    <div className="muted small">{item.process.positionTitle} · {item.process.team?.name || c.noData}</div>
                  </div>
                  <Link className="button button-secondary" href={`/hr/${item.process.id}`}>
                    {c.openDetail}
                  </Link>
                </div>
              ))}
              {panel.finalApprovals.length === 0 ? <div className="muted small">{c.noData}</div> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
