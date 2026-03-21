import Link from "next/link";
import { getRequestLang } from "@/i18n/server";
import { getBrandingSettings } from "@/server/settings";
import { requireActiveUser } from "@/server/current-user";
import UserMenu from "../dashboard/UserMenu";
import { getHrDashboard, hasHrSystemAccess } from "@/server/hr";
import { createHrProcessAction, markHrNotificationReadAction } from "./actions";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBolt,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconPlus,
  IconReport,
  IconUsers
} from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "HR System",
      subtitle: "Proces zapošljavanja, kandidati, CV baza i odobravanja.",
      noAccess: "Nemaš pristup HR System modulu.",
      filtersTitle: "Filteri i pretraga",
      query: "Pretraga kandidata / pozicije / razloga",
      team: "Tim",
      manager: "Menadžer",
      status: "Status",
      all: "Sve",
      apply: "Primeni filtere",
      reset: "Resetuj",
      metricsTitle: "Pregled i KPI",
      totalProcesses: "Ukupno procesa",
      openProcesses: "Otvorene pozicije",
      approvedProcesses: "Odobrene pozicije",
      cancelledProcesses: "Otkazani procesi",
      totalCandidates: "Ukupno kandidata",
      approvedCandidates: "Approved for Employment",
      quarterMetrics: "Kvartalni pregled",
      avgTime: "Prosečno vreme zapošljavanja",
      fillRate: "Stopa uspešno popunjenih pozicija",
      candidateBase: "Baza kandidata",
      candidateBaseHint: "Istorija prijava i ponovna upotreba postojećih kandidata.",
      notifications: "Notifikacije",
      openProcess: "Otvori proces",
      positionTitle: "Pozicija",
      headcount: "Broj izvršilaca",
      priority: "Prioritet",
      reason: "Razlog / zahtev",
      note: "Napomena",
      createProcess: "Kreiraj proces",
      processesTitle: "Otvoreni i aktivni procesi",
      openDetail: "Otvori detalj",
      noProcesses: "Još nema procesa za izabrane filtere.",
      sourceSummary: "Izvori kandidata",
      noCandidates: "Još nema kandidata u bazi.",
      noNotifications: "Nema novih notifikacija.",
      unread: "Nepročitano",
      markRead: "Označi kao pročitano",
      from: "od",
      applicants: "Prijavljeni",
      screened: "HR screening prošli",
      secondRound: "Drugi krug",
      finalApproved: "Odobreni",
      noValue: "—"
    };
  }

  return {
    title: "HR System",
    subtitle: "Hiring workflow, candidate base, CV archive and approvals.",
    noAccess: "You do not have access to the HR System module.",
    filtersTitle: "Filters and search",
    query: "Search candidate / position / reason",
    team: "Team",
    manager: "Manager",
    status: "Status",
    all: "All",
    apply: "Apply filters",
    reset: "Reset",
    metricsTitle: "Overview and KPI",
    totalProcesses: "Total processes",
    openProcesses: "Open positions",
    approvedProcesses: "Approved positions",
    cancelledProcesses: "Canceled processes",
    totalCandidates: "Total candidates",
    approvedCandidates: "Approved for Employment",
    quarterMetrics: "Quarter snapshot",
    avgTime: "Average time to hire",
    fillRate: "Position fill rate",
    candidateBase: "Candidate base",
    candidateBaseHint: "Application history and reuse of existing candidates.",
    notifications: "Notifications",
    openProcess: "Open process",
    positionTitle: "Position",
    headcount: "Headcount",
    priority: "Priority",
    reason: "Reason / request",
    note: "Note",
    createProcess: "Create process",
    processesTitle: "Open and active processes",
    openDetail: "Open detail",
    noProcesses: "No processes for current filters yet.",
    sourceSummary: "Candidate sources",
    noCandidates: "No candidates in the base yet.",
    noNotifications: "No notifications.",
    unread: "Unread",
    markRead: "Mark as read",
    from: "from",
    applicants: "Applicants",
    screened: "Passed HR screening",
    secondRound: "Second round",
    finalApproved: "Approved",
    noValue: "—"
  };
}

function statusClass(status: string) {
  const value = String(status || "").toUpperCase();
  if (["APPROVED", "APPROVED_FOR_EMPLOYMENT", "CLOSED"].includes(value)) return "pill pill-status pill-status-approved";
  if (["OPEN", "IN_PROGRESS", "ON_HOLD", "INTERVIEW_SCHEDULED", "WAITING_FINAL_APPROVAL"].includes(value)) {
    return "pill pill-status pill-status-progress";
  }
  if (["WAITING_MANAGER_REVIEW", "SENT_TO_MANAGER"].includes(value)) return "pill pill-status pill-status-review";
  if (["CANCELED", "REJECTED_BY_HR", "REJECTED_BY_MANAGER", "REJECTED_FINAL"].includes(value)) {
    return "pill pill-status pill-status-rejected";
  }
  return "pill pill-status pill-status-muted";
}

function formatDate(value: Date | string | null | undefined, lang: "sr" | "en") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "sr" ? "sr-RS" : "en-GB", {
    dateStyle: "medium"
  }).format(date);
}

function daysBetween(start: Date | string | null | undefined, end: Date | string | null | undefined) {
  if (!start || !end) return null;
  const from = start instanceof Date ? start : new Date(start);
  const to = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));
}

export default async function HrPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string; teamId?: string; managerId?: string; status?: string; query?: string };
}) {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const c = copy(lang);
  const branding = await getBrandingSettings();

  if (!hasHrSystemAccess(user)) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="header">
            <div>
              <h1>{c.title}</h1>
              <p className="muted">{c.noAccess}</p>
            </div>
            <Link className="button button-secondary" href="/dashboard">
              <IconArrowLeft size={18} /> Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const dashboard = await getHrDashboard(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hrAddon: user.hrAddon,
      teamId: user.teamId,
      managerId: user.managerId
    },
    {
      teamId: searchParams.teamId,
      managerId: searchParams.managerId,
      status: searchParams.status,
      query: searchParams.query
    }
  );

  if (!dashboard.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{dashboard.error}</div>
        </div>
      </main>
    );
  }

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;
  const managerOptions = dashboard.users.filter((member) => member.role === "MANAGER" || member.role === "ADMIN");
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3, 1));
  const quarterEnd = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3 + 3, 0, 23, 59, 59));
  const quarterProcesses = dashboard.processes.filter((process) => {
    const opened = new Date(process.openedAt);
    return opened >= quarterStart && opened <= quarterEnd;
  });
  const quarterFilled = quarterProcesses.filter((process) => process.status === "APPROVED" || process.status === "CLOSED").length;
  const fillRate = quarterProcesses.length ? Math.round((quarterFilled / quarterProcesses.length) * 100) : 0;
  const avgTimeDays =
    quarterProcesses
      .map((process) => daysBetween(process.openedAt, process.closedAt || process.cancelledAt))
      .filter((value): value is number => value != null)
      .reduce((sum, value, _, arr) => sum + value / arr.length, 0) || 0;
  const sourceMap = new Map<string, number>();
  for (const candidate of dashboard.candidates) {
    const key = String(candidate.source || c.noValue).trim() || c.noValue;
    sourceMap.set(key, (sourceMap.get(key) || 0) + 1);
  }
  const sourceRows = [...sourceMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

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

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <section className="panel stack">
          <h2 className="h2">{c.metricsTitle}</h2>
          <div className="grid3 hr-stats-grid">
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconReport size={22} /></div>
              <div>
                <div className="kpi-value">{dashboard.metrics.totalProcesses}</div>
                <div className="kpi-label">{c.totalProcesses}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconBolt size={22} /></div>
              <div>
                <div className="kpi-value">{dashboard.metrics.openProcesses}</div>
                <div className="kpi-label">{c.openProcesses}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconCheckCircle size={22} /></div>
              <div>
                <div className="kpi-value">{dashboard.metrics.approvedProcesses}</div>
                <div className="kpi-label">{c.approvedProcesses}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconUsers size={22} /></div>
              <div>
                <div className="kpi-value">{dashboard.metrics.totalCandidates}</div>
                <div className="kpi-label">{c.totalCandidates}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconCalendar size={22} /></div>
              <div>
                <div className="kpi-value">{Math.round(avgTimeDays || 0)}</div>
                <div className="kpi-label">{c.avgTime}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconClock size={22} /></div>
              <div>
                <div className="kpi-value">{fillRate}%</div>
                <div className="kpi-label">{c.fillRate}</div>
              </div>
            </div>
          </div>

          <div className="grid2">
            <div className="item stack">
              <div className="item-title">{c.quarterMetrics}</div>
              <div className="muted small">
                {quarterProcesses.length} · {c.totalProcesses.toLowerCase()} · {c.fillRate.toLowerCase()} {fillRate}%
              </div>
              <div className="rank-list">
                <div className="rank-row">
                  <span className="rank-badge">Q</span>
                  <div className="rank-body">
                    <div className="rank-title">{c.openProcesses}</div>
                    <div className="rank-bar"><span style={{ width: `${Math.min(100, dashboard.metrics.openProcesses * 10)}%` }} /></div>
                  </div>
                  <div className="rank-value">{dashboard.metrics.openProcesses}</div>
                </div>
                <div className="rank-row">
                  <span className="rank-badge">✓</span>
                  <div className="rank-body">
                    <div className="rank-title">{c.approvedCandidates}</div>
                    <div className="rank-bar"><span style={{ width: `${Math.min(100, dashboard.metrics.approvedCandidates * 10)}%` }} /></div>
                  </div>
                  <div className="rank-value">{dashboard.metrics.approvedCandidates}</div>
                </div>
              </div>
            </div>

            <div className="item stack">
              <div className="item-title">{c.sourceSummary}</div>
              {sourceRows.length ? (
                <div className="rank-list">
                  {sourceRows.map(([source, count], index) => (
                    <div key={source} className="rank-row">
                      <span className="rank-badge">{index + 1}</span>
                      <div className="rank-body">
                        <div className="rank-title">{source}</div>
                        <div className="rank-bar">
                          <span style={{ width: `${Math.min(100, Math.round((count / Math.max(1, dashboard.candidates.length)) * 100))}%` }} />
                        </div>
                      </div>
                      <div className="rank-value">{count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted small">{c.noCandidates}</div>
              )}
            </div>
          </div>
        </section>

        <div className="grid2 hr-main-grid">
          <section className="panel stack">
            <h2 className="h2">{c.filtersTitle}</h2>
            <form className="stack" method="GET">
              <label className="field">
                <span className="label">{c.query}</span>
                <input className="input" name="query" type="text" defaultValue={dashboard.filters.query || ""} />
              </label>
              <div className="grid3">
                <label className="field">
                  <span className="label">{c.team}</span>
                  <select className="input" name="teamId" defaultValue={dashboard.filters.teamId || ""}>
                    <option value="">{c.all}</option>
                    {dashboard.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">{c.manager}</span>
                  <select className="input" name="managerId" defaultValue={dashboard.filters.managerId || ""}>
                    <option value="">{c.all}</option>
                    {managerOptions.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">{c.status}</span>
                  <select className="input" name="status" defaultValue={dashboard.filters.status || "ALL"}>
                    <option value="ALL">{c.all}</option>
                    {["OPEN", "IN_PROGRESS", "ON_HOLD", "APPROVED", "CLOSED", "CANCELED"].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="inline">
                <button className="button" type="submit">
                  {c.apply}
                </button>
                <Link className="button button-secondary" href="/hr">
                  {c.reset}
                </Link>
              </div>
            </form>
          </section>

          <section className="panel stack">
            <h2 className="h2">{c.notifications}</h2>
            <div className="list">
              {dashboard.notifications.map((notification) => (
                <div key={notification.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{notification.title}</div>
                      <div className="muted small">{notification.body || c.noValue}</div>
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
                        <input type="hidden" name="returnTo" value="/hr" />
                        <button className="button button-secondary" type="submit">
                          {c.markRead}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
              {dashboard.notifications.length === 0 ? <div className="muted small">{c.noNotifications}</div> : null}
            </div>
          </section>
        </div>

        <div className="grid2 hr-main-grid">
          <section className="panel stack">
            <h2 className="h2">{c.openProcess}</h2>
            <form className="stack" action={createHrProcessAction}>
              <div className="grid2">
                <label className="field">
                  <span className="label">{c.team}</span>
                  <select className="input" name="teamId" defaultValue={dashboard.filters.teamId || ""}>
                    <option value="">{c.all}</option>
                    {dashboard.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">{c.manager}</span>
                  <select className="input" name="managerId" defaultValue="">
                    <option value="">{c.all}</option>
                    {managerOptions.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid3">
                <label className="field">
                  <span className="label">{c.positionTitle}</span>
                  <input className="input" name="positionTitle" type="text" required />
                </label>
                <label className="field">
                  <span className="label">{c.headcount}</span>
                  <input className="input" name="requestedHeadcount" type="number" min={1} defaultValue={1} />
                </label>
                <label className="field">
                  <span className="label">{c.priority}</span>
                  <select className="input" name="priority" defaultValue="MED">
                    <option value="LOW">LOW</option>
                    <option value="MED">MED</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span className="label">{c.reason}</span>
                <textarea className="input" name="reason" rows={3} required />
              </label>
              <label className="field">
                <span className="label">{c.note}</span>
                <textarea className="input" name="note" rows={2} />
              </label>
              <button className="button" type="submit">
                <IconPlus size={18} /> {c.createProcess}
              </button>
            </form>
          </section>

          <section className="panel stack">
            <h2 className="h2">{c.candidateBase}</h2>
            <div className="muted small">{c.candidateBaseHint}</div>
            <div className="list">
              {dashboard.candidates.map((candidate) => (
                <div key={candidate.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{candidate.fullName}</div>
                      <div className="muted small">
                        {candidate.email || c.noValue} · {candidate.phone || c.noValue} · {candidate.source || c.noValue}
                      </div>
                    </div>
                    <span className="pill">{candidate.latestCvFileName || "CV"}</span>
                  </div>
                  <div className="muted small">
                    {candidate.applications
                      .map((application) => `${application.process.positionTitle} · ${application.process.team?.name || c.noValue} · ${application.status}`)
                      .join(" • ")}
                  </div>
                </div>
              ))}
              {dashboard.candidates.length === 0 ? <div className="muted small">{c.noCandidates}</div> : null}
            </div>
          </section>
        </div>

        <section className="panel stack">
          <h2 className="h2">{c.processesTitle}</h2>
          <div className="list">
            {dashboard.processes.map((process) => {
              const applicants = process.candidates.length;
              const screened = process.candidates.filter((candidate) => candidate.status !== "NEW_APPLICANT").length;
              const secondRound = process.candidates.filter((candidate) =>
                ["INTERVIEW_SCHEDULED", "SECOND_ROUND_COMPLETED", "WAITING_FINAL_APPROVAL", "APPROVED_FOR_EMPLOYMENT"].includes(candidate.status)
              ).length;
              const approved = process.candidates.filter((candidate) => candidate.status === "APPROVED_FOR_EMPLOYMENT").length;
              return (
                <div key={process.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{process.positionTitle}</div>
                      <div className="muted small">
                        {process.team?.name || c.noValue} · {c.priority}: {process.priority} · {c.manager}: {process.manager?.name || c.noValue}
                      </div>
                    </div>
                    <div className="pills">
                      <span className={statusClass(process.status)}>{process.status}</span>
                      <span className="pill">{process.requestedHeadcount}</span>
                    </div>
                  </div>
                  <div className="grid4 hr-metric-grid">
                    <div className="item">
                      <div className="process-card-label">{c.applicants}</div>
                      <div className="process-card-value">{applicants}</div>
                    </div>
                    <div className="item">
                      <div className="process-card-label">{c.screened}</div>
                      <div className="process-card-value">{screened}</div>
                    </div>
                    <div className="item">
                      <div className="process-card-label">{c.secondRound}</div>
                      <div className="process-card-value">{secondRound}</div>
                    </div>
                    <div className="item">
                      <div className="process-card-label">{c.finalApproved}</div>
                      <div className="process-card-value">{approved}</div>
                    </div>
                  </div>
                  <div className="inline">
                    <span className="muted small">{formatDate(process.openedAt, lang)} · {c.from} {process.openedBy.name}</span>
                    <Link className="button button-secondary" href={`/hr/${process.id}`}>
                      {c.openDetail} <IconArrowRight size={18} />
                    </Link>
                  </div>
                </div>
              );
            })}
            {dashboard.processes.length === 0 ? <div className="muted small">{c.noProcesses}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
