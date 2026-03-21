import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { getRequestLang } from "@/i18n/server";
import { getBrandingSettings } from "@/server/settings";
import { requireActiveUser } from "@/server/current-user";
import UserMenu from "../dashboard/UserMenu";
import { getHrDashboard, hasHrSystemAccess } from "@/server/hr";
import { buildHrDashboardBuckets, getProcessWorkflowSummary, type HrNextActionKey, type HrStageKey, type HrWaitingOnKey } from "@/server/hr-presentation";
import { markHrNotificationReadAction } from "./actions";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBolt,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconReport,
  IconUsers
} from "@/components/icons";
import { isManagerRole } from "@/server/rbac";

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
      workflowTitle: "Kako izgleda tok zapošljavanja",
      workflowSubtitle: "Proces ostaje isti, ali je sada prikazan jednostavnije: zahtev → odobrenje → HR obrada → intervjui → odluka → onboarding.",
      stepOne: "1. Menadžer otvara zahtev",
      stepOneText: "Novi zahtev za zapošljavanje otvara se iz Management Panel-a, ne iz HR ekrana.",
      stepTwo: "2. Nadređeni odobrava",
      stepTwoText: "Samo jedan nivo iznad menadžera potvrđuje ili odbija zahtev.",
      stepThree: "3. HR počinje screening",
      stepThreeText: "Tek kada je zahtev odobren, HR dodaje i obrađuje kandidate.",
      stepFour: "4. Menadžer vodi sledeći krug",
      stepFourText: "Menadžer pregleda odabrane kandidate i daje komentar za dalje.",
      stepFive: "5. Finalna odluka i onboarding",
      stepFiveText: "Posle finalnog odobrenja kandidat prelazi u onboarding tok.",
      managerStartTitle: "Početak procesa je u Management Panel-u",
      managerStartText: "Da bismo HR ekran držali čistim, novi hiring request se otvara tamo gde menadžer već prati tim i odobrenja.",
      openManagement: "Otvori Management Panel",
      actionQueuesTitle: "Šta trenutno čeka HR",
      actionQueuesSubtitle: "Najbitnije radne kolone — bez suvišnih statusa i bez traženja po više ekrana.",
      readyForHr: "Spremno za HR",
      readyForHrText: "Odobreni zahtevi gde HR treba da započne rad i doda prve kandidate.",
      screeningQueue: "HR screening",
      screeningQueueText: "Kandidati koje HR treba da obradi ili dopuni prvim komentarima.",
      managerQueue: "Čeka menadžera",
      managerQueueText: "Kandidati koji su prosleđeni menadžeru za pregled ili nastavak kruga.",
      finalQueue: "Finalna odluka",
      finalQueueText: "Kandidati koji čekaju finalno odobrenje nadređenog.",
      onboardingQueue: "Spremno za onboarding",
      onboardingQueueText: "Kandidati koji su odobreni za zaposlenje i treba da pređu u onboarding.",
      currentPhase: "Trenutna faza",
      waitingOn: "Na potezu je",
      nextAction: "Sledeći korak",
      systemStatus: "Sistemski status",
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
      read: "Pročitano",
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
    workflowTitle: "How hiring works",
    workflowSubtitle: "The logic stays the same, but the UI is now clearer: request → approval → HR screening → interviews → decision → onboarding.",
    stepOne: "1. Manager opens request",
    stepOneText: "A new hiring request starts in the Management Panel, not inside the HR workspace.",
    stepTwo: "2. Superior approves",
    stepTwoText: "Only one approval level above the requesting manager confirms or rejects the request.",
    stepThree: "3. HR starts screening",
    stepThreeText: "HR enters the process only after the request is approved.",
    stepFour: "4. Manager drives the next round",
    stepFourText: "The manager reviews shortlisted candidates and guides the next interview step.",
    stepFive: "5. Final decision and onboarding",
    stepFiveText: "After final approval, HR moves the candidate into onboarding.",
    managerStartTitle: "The process starts in the Management Panel",
    managerStartText: "To keep HR clean and practical, new hiring requests are opened where managers already handle team visibility and approvals.",
    openManagement: "Open Management Panel",
    actionQueuesTitle: "What is currently waiting for HR",
    actionQueuesSubtitle: "The most important working columns — no extra status noise and no hunting across screens.",
    readyForHr: "Ready for HR",
    readyForHrText: "Approved requests where HR should start work and add the first candidates.",
    screeningQueue: "HR screening",
    screeningQueueText: "Candidates HR still needs to process or enrich with first-round notes.",
    managerQueue: "Waiting for manager",
    managerQueueText: "Candidates already sent forward and now waiting for manager review or next-step input.",
    finalQueue: "Final decision",
    finalQueueText: "Candidates waiting for the final superior decision.",
    onboardingQueue: "Ready for onboarding",
    onboardingQueueText: "Candidates approved for hire and ready to move into onboarding.",
    currentPhase: "Current phase",
    waitingOn: "Waiting on",
    nextAction: "Next action",
    systemStatus: "System status",
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
    read: "Read",
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

function toneClass(tone: "muted" | "review" | "progress" | "approved" | "rejected") {
  if (tone === "approved") return "process-card process-card-approved";
  if (tone === "review") return "process-card process-card-review";
  if (tone === "progress") return "process-card process-card-progress";
  if (tone === "rejected") return "process-card process-card-rejected";
  return "process-card process-card-muted";
}

function stageLabel(lang: "sr" | "en", stage: HrStageKey) {
  const labels =
    lang === "sr"
      ? {
          REQUEST_APPROVAL: "Čeka odobrenje zahteva",
          READY_FOR_HR: "HR screening",
          MANAGER_REVIEW: "Pregled menadžera",
          ROUND_TWO: "Drugi krug",
          FINAL_DECISION: "Finalna odluka",
          APPROVED_FOR_HIRE: "Spremno za onboarding",
          PAUSED: "Na čekanju",
          CLOSED: "Zatvoreno",
          CANCELED: "Otkazano"
        }
      : {
          REQUEST_APPROVAL: "Request approval",
          READY_FOR_HR: "HR screening",
          MANAGER_REVIEW: "Manager review",
          ROUND_TWO: "Round 2",
          FINAL_DECISION: "Final decision",
          APPROVED_FOR_HIRE: "Ready for onboarding",
          PAUSED: "On hold",
          CLOSED: "Closed",
          CANCELED: "Canceled"
        };

  return labels[stage];
}

function waitingOnLabel(
  lang: "sr" | "en",
  waitingOn: HrWaitingOnKey,
  names?: { manager?: string | null; finalApprover?: string | null }
) {
  if (waitingOn === "MANAGER") return names?.manager || (lang === "sr" ? "Menadžer" : "Manager");
  if (waitingOn === "FINAL_APPROVER") return names?.finalApprover || (lang === "sr" ? "Nadređeni menadžer" : "Superior manager");
  if (waitingOn === "HR") return lang === "sr" ? "HR" : "HR";
  if (waitingOn === "SUPERIOR") return names?.finalApprover || (lang === "sr" ? "Nadređeni" : "Superior");
  return lang === "sr" ? "Niko" : "No one";
}

function nextActionLabel(lang: "sr" | "en", nextAction: HrNextActionKey) {
  const labels =
    lang === "sr"
      ? {
          APPROVE_REQUEST: "Nadređeni treba da odobri ili odbije zahtev.",
          START_SCREENING: "HR treba da započne screening i doda prve kandidate.",
          SCREEN_CANDIDATES: "HR treba da obradi kandidate i odluči ko ide dalje.",
          MANAGER_REVIEW: "Menadžer treba da pregleda izabrane kandidate.",
          ROUND_TWO_FEEDBACK: "Potrebno je završiti drugi krug i zabeležiti ishod.",
          FINAL_DECISION: "Čeka se finalna odluka nadređenog.",
          START_ONBOARDING: "HR može da pokrene onboarding za odobrenog kandidata.",
          WAITING_INPUT: "Proces je pauziran dok ne stigne sledeći poslovni signal.",
          PROCESS_COMPLETE: "Proces je završen i ostaje vidljiv u istoriji.",
          PROCESS_CANCELED: "Proces je otkazan i ostaje samo u istoriji."
        }
      : {
          APPROVE_REQUEST: "The superior needs to approve or reject the request.",
          START_SCREENING: "HR should start screening and add the first candidates.",
          SCREEN_CANDIDATES: "HR should process candidates and decide who moves forward.",
          MANAGER_REVIEW: "The manager should review shortlisted candidates.",
          ROUND_TWO_FEEDBACK: "Round 2 needs to be completed and documented.",
          FINAL_DECISION: "Waiting for the final superior decision.",
          START_ONBOARDING: "HR can start onboarding for the approved candidate.",
          WAITING_INPUT: "The process is paused until the next business signal arrives.",
          PROCESS_COMPLETE: "The process is finished and remains in history.",
          PROCESS_CANCELED: "The process was canceled and remains in history."
        };

  return labels[nextAction];
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
  const managerOptions = dashboard.users.filter((member) => isManagerRole(member.role));
  const queueBuckets = buildHrDashboardBuckets(dashboard.processes);
  const processRows = dashboard.processes.map((process) => ({
    process,
    summary: getProcessWorkflowSummary(process)
  }));

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
            hrAddon={user.hrAddon}
            adminAddon={user.adminAddon}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <section className="panel stack">
          <div className="section-copy">
            <h2 className="h2">
              <LabelWithTooltip
                label={c.metricsTitle}
                tooltip={
                  lang === "sr"
                    ? "Brzi pregled obima zapošljavanja, opterećenja HR-a i trenutnog tempa popunjavanja pozicija."
                    : "A quick view of hiring volume, HR workload, and how fast positions are being filled."
                }
              />
            </h2>
          </div>
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

        <section className="panel stack">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={c.filtersTitle}
                  tooltip={
                    lang === "sr"
                      ? "Filtriraj procese po timu, menadžeru i statusu kada želiš da se fokusiraš samo na deo hiring pipeline-a."
                      : "Filter processes by team, manager, and status when you want to focus on a specific part of the hiring pipeline."
                  }
                />
              </h2>
            </div>
            <form className="stack" method="GET">
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.query}
                    tooltip={
                      lang === "sr"
                        ? "Pretraga radi preko pozicije, razloga zahteva, imena kandidata i drugih povezanih podataka."
                        : "Search works across position titles, request reasons, candidate names, and other related process data."
                    }
                  />
                </span>
                <input className="input" name="query" type="text" defaultValue={dashboard.filters.query || ""} />
              </label>
              <div className="grid3">
                <label className="field">
                  <span className="label">
                    <LabelWithTooltip
                      label={c.team}
                      tooltip={
                        lang === "sr"
                          ? "Koristi tim filter kada HR želi da se fokusira na jedan sektor ili kada menadžer prati samo svoj deo organizacije."
                          : "Use the team filter when HR wants to focus on one department or when a manager is reviewing a narrower part of the organization."
                      }
                    />
                  </span>
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
                  <span className="label">
                    <LabelWithTooltip
                      label={c.manager}
                      tooltip={
                        lang === "sr"
                          ? "Ovo je odgovorni menadžer za zahtev, ne HR owner. Pomaže kada više timova radi paralelno."
                          : "This is the manager responsible for the request, not the HR owner. It helps when several teams are hiring in parallel."
                      }
                    />
                  </span>
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
                  <span className="label">
                    <LabelWithTooltip
                      label={c.status}
                      tooltip={
                        lang === "sr"
                          ? "Sistemski status procesa je detaljniji od prikazanih faza. Faze niže služe za lakše praćenje rada, a status ostaje izvor istine."
                          : "The system status is more detailed than the simplified phases below. Phases help people work faster, while status remains the source of truth."
                      }
                    />
                  </span>
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
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={c.notifications}
                  tooltip={
                    lang === "sr"
                      ? "Ovde stižu ključne HR i hiring promene: komentar menadžera, spremni termini, finalna odluka ili sledeći korak."
                      : "This is the compact HR notification stream: manager comments, proposed slots, final decisions, and other key next-step updates."
                  }
                />
              </h2>
            </div>
            <div className="list">
              {dashboard.notifications.map((notification) => (
                <div key={notification.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{notification.title}</div>
                      <div className="muted small">{notification.body || c.noValue}</div>
                    </div>
                    <span className={notification.isRead ? "pill pill-status pill-status-muted" : "pill pill-status pill-status-review"}>
                      {notification.isRead ? c.read : c.unread}
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
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={c.workflowTitle}
                  tooltip={
                    lang === "sr"
                      ? "Ovo je uprošćen prikaz istog workflow-a: ne menja logiku, već pomaže da se odmah zna gde proces počinje i ko je sledeći na potezu."
                      : "This is a simplified view of the same workflow. It does not change the logic; it simply makes it easier to see where a process starts and who owns the next step."
                  }
                />
              </h2>
              <p className="muted small">{c.workflowSubtitle}</p>
            </div>

            <div className="workflow-strip">
              {[
                { step: c.stepOne, text: c.stepOneText },
                { step: c.stepTwo, text: c.stepTwoText },
                { step: c.stepThree, text: c.stepThreeText },
                { step: c.stepFour, text: c.stepFourText },
                { step: c.stepFive, text: c.stepFiveText }
              ].map((item, index) => (
                <div key={item.step} className="workflow-step">
                  <div className="workflow-step-index">{index + 1}</div>
                  <div className="flow-step-copy">
                    <div className="flow-step-title">{item.step}</div>
                    <div className="flow-step-text muted small">{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel stack">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={c.managerStartTitle}
                  tooltip={
                    lang === "sr"
                      ? "Zahtev za zapošljavanje otvara menadžer iz svog prostora. HR ekran ostaje fokusiran na obradu kandidata i sledeće korake."
                      : "A hiring request starts from the manager workspace. The HR area stays focused on candidate handling and next-step execution."
                  }
                />
              </h2>
              <p className="muted small">{c.managerStartText}</p>
            </div>
            {isManagerRole(user.role) ? (
              <div className="inline">
                <Link className="button" href="/management">
                  {c.openManagement} <IconArrowRight size={18} />
                </Link>
              </div>
            ) : null}
            <div className="notice notice-info">
              <div className="notice-icon"><IconUsers size={18} /></div>
              <div className="muted small">
                {lang === "sr"
                  ? "HR koristi ovaj ekran tek kada zahtev dobije superior approval. Tako ostaje jasno šta je zahtev, a šta je obrada kandidata."
                  : "HR uses this workspace only after the hiring request receives superior approval. That keeps the request step separate from candidate processing."}
              </div>
            </div>
          </section>
        </div>

        <section className="panel stack">
          <div className="section-copy">
            <h2 className="h2">
              <LabelWithTooltip
                label={c.actionQueuesTitle}
                tooltip={
                  lang === "sr"
                    ? "Najvažnije kolone za rad. Svaka kartica sabira ono što zaista traži sledeću HR akciju."
                    : "These are the key working buckets. Each card summarizes items that truly need the next HR action."
                }
              />
            </h2>
            <p className="muted small">{c.actionQueuesSubtitle}</p>
          </div>

          <div className="grid4 hr-metric-grid">
            <div className={toneClass("review")}>
              <div className="process-card-icon"><IconCheckCircle size={20} /></div>
              <div className="process-card-body">
                <div className="process-card-label">{c.readyForHr}</div>
                <div className="process-card-value">{queueBuckets.readyForHr}</div>
                <div className="muted small">{c.readyForHrText}</div>
              </div>
            </div>
            <div className={toneClass("review")}>
              <div className="process-card-icon"><IconUsers size={20} /></div>
              <div className="process-card-body">
                <div className="process-card-label">{c.screeningQueue}</div>
                <div className="process-card-value">{queueBuckets.hrScreening}</div>
                <div className="muted small">{c.screeningQueueText}</div>
              </div>
            </div>
            <div className={toneClass("progress")}>
              <div className="process-card-icon"><IconArrowRight size={20} /></div>
              <div className="process-card-body">
                <div className="process-card-label">{c.managerQueue}</div>
                <div className="process-card-value">{queueBuckets.managerReview}</div>
                <div className="muted small">{c.managerQueueText}</div>
              </div>
            </div>
            <div className={toneClass("approved")}>
              <div className="process-card-icon"><IconCalendar size={20} /></div>
              <div className="process-card-body">
                <div className="process-card-label">{c.onboardingQueue}</div>
                <div className="process-card-value">{queueBuckets.approvedForHire}</div>
                <div className="muted small">{c.onboardingQueueText}</div>
              </div>
            </div>
          </div>
          <div className="grid2 hr-main-grid">
            <div className={toneClass("review")}>
              <div className="process-card-icon"><IconClock size={20} /></div>
              <div className="process-card-body">
                <div className="process-card-label">{c.finalQueue}</div>
                <div className="process-card-value">{queueBuckets.finalDecision}</div>
                <div className="muted small">{c.finalQueueText}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid2 hr-main-grid">
          <section className="panel stack">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={c.candidateBase}
                  tooltip={
                    lang === "sr"
                      ? "Kandidati ostaju sačuvani i kada nisu aktivni u trenutnom procesu, da HR može lakše da ih vrati u rad ili proveri istoriju."
                      : "Candidates remain reusable even when they are not active in the current process, so HR can bring them back later or check their history."
                  }
              />
            </h2>
              <p className="muted small">{c.candidateBaseHint}</p>
            </div>
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

        <section className="panel stack">
          <div className="section-copy">
            <h2 className="h2">
              <LabelWithTooltip
                label={c.processesTitle}
                tooltip={
                  lang === "sr"
                    ? "Svaki proces prikazuje i uprošćenu fazu rada i sistemski status, kako bi HR i menadžeri lakše znali šta stvarno sledi."
                    : "Each process shows both the simplified work phase and the underlying system status, so HR and managers can quickly see what really happens next."
                }
              />
            </h2>
          </div>
          <div className="list">
            {processRows.map(({ process, summary }) => {
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
                    <div className={toneClass(summary.tone)}>
                      <div className="process-card-body">
                        <div className="process-card-label">{c.currentPhase}</div>
                        <div className="item-title">{stageLabel(lang, summary.stageKey)}</div>
                      </div>
                    </div>
                    <div className="process-card process-card-muted">
                      <div className="process-card-body">
                        <div className="process-card-label">{c.waitingOn}</div>
                        <div className="item-title">
                          {waitingOnLabel(lang, summary.waitingOn, {
                            manager: process.manager?.name,
                            finalApprover: process.finalApprover?.name
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="process-card process-card-muted">
                      <div className="process-card-body">
                        <div className="process-card-label">{c.nextAction}</div>
                        <div className="muted small">{nextActionLabel(lang, summary.nextAction)}</div>
                      </div>
                    </div>
                    <div className="process-card process-card-muted">
                      <div className="process-card-body">
                        <div className="process-card-label">{c.systemStatus}</div>
                        <div className="item-title">{process.status}</div>
                      </div>
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
