import Link from "next/link";
import { redirect } from "next/navigation";
import { LabelWithTooltip } from "@/components/Tooltip";
import { getRequestLang } from "@/i18n/server";
import { requireActiveUser } from "@/server/current-user";
import { getManagementPanel, hasManagementPanelAccess } from "@/server/hr";
import { HIRING_REQUEST_TYPES } from "@/server/hr-workflow";
import { createHrProcessAction, markHrNotificationReadAction } from "../hr/actions";
import { isHrModuleEnabled } from "@/server/features";
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
      pendingApprovalsTitle: "Čeka superior approval",
      openTasks: "Otvoreni taskovi",
      overdue: "Overdue taskovi",
      evaluations: "Aktivne evaluacije",
      absences: "Aktivna odsustva",
      notifications: "Obaveštenja",
      reviewQueue: "Kandidati za pregled",
      finalQueue: "Zahtevi za finalno odobrenje",
      activeProcesses: "Aktivni procesi",
      startHiring: "Ovde počinje zapošljavanje",
      startHiringText: "Menadžer otvara zahtev, nadređeni daje jedno odobrenje, a HR preuzima proces tek nakon toga.",
      requestFormTitle: "Korak 1 — Novi hiring request",
      requestFormText: "Unesi samo osnovne poslovne podatke. Kandidati i screening se vode kasnije, kada HR preuzme odobren zahtev.",
      teamLabel: "Tim",
      positionLabel: "Pozicija",
      systemPositionLabel: "Pozicija iz sistematizacije",
      requestTypeLabel: "Tip angažovanja",
      budgetedLabel: "Budžetirana pozicija",
      budgetRangeLabel: "Budžet / opseg plate",
      systematizationLabel: "Postoji u sistematizaciji",
      draftJobDescriptionLabel: "Link ka draft opisu pozicije",
      priorityLabel: "Prioritet",
      desiredStartDateLabel: "Željeni datum početka",
      headcountLabel: "Broj izvršilaca",
      reasonLabel: "Razlog",
      managerCommentLabel: "Komentar menadžera",
      createRequest: "Kreiraj zahtev",
      replacementPlaceholder: "Ako nije u sistematizaciji, upiši naziv nove pozicije",
      noData: "Nema podataka za prikaz.",
      openDetail: "Otvori detalj",
      markRead: "Označi kao pročitano",
      unread: "Nepročitano",
      read: "Pročitano",
      notificationsHelp: "Ovde vidiš šta je novo u hiring toku za tvoj tim i šta traži reakciju sa tvoje strane.",
      activeProcessesHelp: "Aktivni procesi su već u radu. Ovde brzo vidiš status, prioritet i koliko kandidata je već vezano za svaku poziciju.",
      superiorApprovalsHelp: "Ovo su zahtevi koje su otvorili tvoji direktni menadžeri i koji čekaju tvoje jedno odobrenje pre nego što HR krene dalje.",
      reviewQueueHelp: "Kandidati koji su prošli HR screening i čekaju tvoj pregled za sledeći korak.",
      finalQueueHelp: "Kandidati koji su stigli do završne odluke i čekaju tvoje finalno odobrenje ili odbijanje."
    };
  }

  return {
    title: "Management Panel",
    subtitle: "Team KPI, approvals, open positions and notifications.",
    noAccess: "You do not have access to the Management Panel section.",
    openPositions: "Open positions",
    pendingReviews: "Waiting manager review",
    finalApprovals: "Waiting final approval",
    pendingApprovalsTitle: "Pending superior approvals",
    openTasks: "Open tasks",
    overdue: "Overdue tasks",
    evaluations: "Active evaluations",
    absences: "Active absences",
    notifications: "Notifications",
    reviewQueue: "Candidates for review",
    finalQueue: "Final approval requests",
    activeProcesses: "Active processes",
    startHiring: "This is where hiring starts",
    startHiringText: "The manager opens the request, the superior gives one approval, and HR enters only after that approval is done.",
    requestFormTitle: "Step 1 — New hiring request",
    requestFormText: "Enter only the core business request. Candidates and screening are handled later, once HR takes over the approved request.",
    teamLabel: "Team",
      positionLabel: "Position",
    systemPositionLabel: "Systematized position",
    requestTypeLabel: "Engagement type",
    budgetedLabel: "Budgeted position",
    budgetRangeLabel: "Budget / salary range",
    systematizationLabel: "Exists in systematization",
    draftJobDescriptionLabel: "Draft job description link",
    priorityLabel: "Priority",
    desiredStartDateLabel: "Desired start date",
    headcountLabel: "Headcount",
    reasonLabel: "Reason",
    managerCommentLabel: "Manager comment",
    createRequest: "Create request",
    replacementPlaceholder: "If not systematized, type the new position title",
    noData: "No data to show.",
    openDetail: "Open detail",
    markRead: "Mark as read",
    unread: "Unread",
    read: "Read",
    notificationsHelp: "This is your hiring activity feed: what changed, what is new, and what needs your reaction.",
    activeProcessesHelp: "Active processes are already in motion. Use this list to quickly see status, priority, and how many candidates are attached to each opening.",
    superiorApprovalsHelp: "These are requests opened by your direct managers and waiting for your one approval before HR can continue.",
    reviewQueueHelp: "Candidates who passed HR screening and are now waiting for your manager review.",
    finalQueueHelp: "Candidates that reached the final decision stage and now need your final approval or rejection."
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
  if (!isHrModuleEnabled()) {
    redirect("/dashboard");
  }
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const c = copy(lang);

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
            <div>
              <h1 className="brand-title">{c.title}</h1>
              <p className="muted">{c.subtitle}</p>
            </div>
            <div className="inline">
              <Link className="button button-secondary" href="/dashboard">
                <IconArrowLeft size={18} /> Dashboard
              </Link>
            </div>
          </div>
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
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={c.requestFormTitle}
                  tooltip={
                    lang === "sr"
                      ? "Ovaj ekran pokreće samo zahtev za otvaranje pozicije. Ne unosiš kandidate ovde — to počinje kada superior odobri zahtev i HR preuzme proces."
                      : "This screen starts only the hiring request. You do not enter candidates here — that begins after the superior approves the request and HR takes over."
                  }
                />
              </h2>
              <p className="muted small">{c.requestFormText}</p>
            </div>
            <div className="notice notice-info">
              <div className="notice-icon"><IconClock size={18} /></div>
              <div className="muted small">{c.startHiringText}</div>
            </div>
            <form className="grid2" action={createHrProcessAction}>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.teamLabel}
                    tooltip={
                      lang === "sr"
                        ? "Izaberi tim za koji se otvara pozicija. Ovo određuje ko će videti proces i ko je odgovoran u daljim koracima."
                        : "Choose the team the position belongs to. This drives ownership and who sees the process later on."
                    }
                  />
                </span>
                <select className="input" name="teamId" defaultValue={user.teamId ?? panel.teams[0]?.id ?? ""}>
                  {panel.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.systemPositionLabel}
                    tooltip={
                      lang === "sr"
                        ? "Ako pozicija već postoji u organizacionoj strukturi, izaberi je ovde. Sistem će koristiti njen naziv, tim i dokumentaciju kao osnovu za hiring."
                        : "If the position already exists in the organization structure, choose it here. The system will use its title, team, and documentation as the hiring basis."
                    }
                  />
                </span>
                <select className="input" name="positionId" defaultValue="">
                  <option value="">{c.noData}</option>
                  {panel.positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.title} {position.team?.name ? `· ${position.team.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.positionLabel}
                    tooltip={
                      lang === "sr"
                        ? "Popuni samo ako pozicija ne postoji u sistematizaciji ili želiš da predložiš novi naziv."
                        : "Fill this only if the position does not exist in systematization or you want to propose a new title."
                    }
                  />
                </span>
                <input className="input" name="positionTitle" type="text" placeholder={c.replacementPlaceholder} />
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.requestTypeLabel}
                    tooltip={
                      lang === "sr"
                        ? "Standardizovan tip angažovanja pomaže HR-u da filtrira procese i pripremi pravi onboarding."
                        : "A standardized engagement type helps HR filter processes and prepare the correct onboarding."
                    }
                  />
                </span>
                <select className="input" name="requestType" defaultValue="FULL_TIME">
                  {HIRING_REQUEST_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {lang === "sr" ? type.sr : type.en}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.priorityLabel}
                    tooltip={
                      lang === "sr"
                        ? "Prioritet služi za redosled obrade. Nemoj ga koristiti za opis hitnosti ako razlog već to objašnjava."
                        : "Priority helps people sort the request queue. Use it for urgency, not as a replacement for the business reason."
                    }
                  />
                </span>
                <select className="input" name="priority" defaultValue="MED">
                  <option value="LOW">LOW</option>
                  <option value="MED">MED</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.desiredStartDateLabel}
                    tooltip={
                      lang === "sr"
                        ? "Ovo je ciljani datum početka rada, ne datum objave oglasa."
                        : "This is the target employee start date, not the ad publishing date."
                    }
                  />
                </span>
                <input className="input" name="desiredStartDate" type="date" />
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.systematizationLabel}
                    tooltip={
                      lang === "sr"
                        ? "Ako ne postoji u sistematizaciji, HR zna da prvo treba pripremiti finalan opis i strukturu pozicije."
                        : "If it does not exist in systematization, HR knows the final job description and structure must be prepared first."
                    }
                  />
                </span>
                <select className="input" name="isInSystematization" defaultValue="true">
                  <option value="true">{lang === "sr" ? "Da" : "Yes"}</option>
                  <option value="false">{lang === "sr" ? "Ne" : "No"}</option>
                </select>
              </label>
              <label className="field">
                <span className="label">{c.budgetedLabel}</span>
                <select className="input" name="isBudgeted" defaultValue="true">
                  <option value="true">{lang === "sr" ? "Da" : "Yes"}</option>
                  <option value="false">{lang === "sr" ? "Ne" : "No"}</option>
                </select>
              </label>
              <label className="field">
                <span className="label">{c.budgetRangeLabel}</span>
                <input className="input" name="budgetRange" type="text" placeholder={lang === "sr" ? "npr. 900–1200 EUR" : "e.g. 900–1200 EUR"} />
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.headcountLabel}
                    tooltip={
                      lang === "sr"
                        ? "Broj izvršilaca koje treba otvoriti kroz isti zahtev."
                        : "How many hires you want to request under this single opening."
                    }
                  />
                </span>
                <input className="input" name="requestedHeadcount" type="number" min={1} max={20} defaultValue={1} />
              </label>
              <label className="field">
                <span className="label">{c.draftJobDescriptionLabel}</span>
                <input className="input" name="draftJobDescriptionUrl" type="url" placeholder="https://drive.google.com/..." />
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.reasonLabel}
                    tooltip={
                      lang === "sr"
                        ? "U nekoliko rečenica objasni poslovni razlog: rast, zamena, opterećenje tima, novi projekat ili sličan razlog."
                        : "Explain the business need in a few clear sentences: growth, replacement, workload, a new project, or a similar reason."
                    }
                  />
                </span>
                <input className="input" name="reason" type="text" required />
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.managerCommentLabel}
                    tooltip={
                      lang === "sr"
                        ? "Dodatni kontekst za HR ili superiora: bitni rokovi, očekivanja ili detalji koje treba znati pre odobrenja."
                        : "Optional extra context for HR or the superior: timelines, expectations, or anything that matters before approval."
                    }
                  />
                </span>
                <input className="input" name="note" type="text" />
              </label>
              <div className="field field-actions">
                <span className="label"> </span>
                <button className="button" type="submit">{c.createRequest}</button>
              </div>
            </form>
          </section>

          <section className="panel stack">
            <div className="section-head">
              <div>
                <h2 className="h2">
                  <LabelWithTooltip label={c.notifications} tooltip={c.notificationsHelp} />
                </h2>
                <div className="muted small">{c.notificationsHelp}</div>
              </div>
              <div className="pills">
                <span className="pill pill-status pill-status-review">
                  {panel.notifications.filter((notification) => !notification.isRead).length} {c.unread}
                </span>
              </div>
            </div>
            <div className="list">
              {panel.notifications.map((notification) => (
                <div key={notification.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{notification.title}</div>
                      <div className="muted small">{notification.body || c.noData}</div>
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
            <div className="section-head">
              <div>
                <h2 className="h2">
                  <LabelWithTooltip label={c.activeProcesses} tooltip={c.activeProcessesHelp} />
                </h2>
                <div className="muted small">{c.activeProcessesHelp}</div>
              </div>
              <div className="pills">
                <span className="pill pill-status pill-status-progress">{panel.processes.length}</span>
              </div>
            </div>
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
            <div className="section-head">
              <div>
                <h2 className="h2">
                  <LabelWithTooltip label={c.pendingApprovalsTitle} tooltip={c.superiorApprovalsHelp} />
                </h2>
                <div className="muted small">{c.superiorApprovalsHelp}</div>
              </div>
              <div className="pills">
                <span className="pill pill-status pill-status-review">{panel.pendingSuperiorApprovals.length}</span>
              </div>
            </div>
            <div className="list">
              {panel.pendingSuperiorApprovals.map((process) => (
                <div key={process.id} className="item item-compact">
                  <div>
                    <div className="item-title">{process.positionTitle}</div>
                    <div className="muted small">
                      {process.team?.name || c.noData} · {process.priority} · {process.openedBy?.name || c.noData}
                    </div>
                  </div>
                  <Link className="button button-secondary" href={`/hr/${process.id}`}>
                    {c.openDetail}
                  </Link>
                </div>
              ))}
              {panel.pendingSuperiorApprovals.length === 0 ? <div className="muted small">{c.noData}</div> : null}
            </div>
          </section>

          <section className="panel stack">
            <div className="section-head">
              <div>
                <h2 className="h2">
                  <LabelWithTooltip label={c.reviewQueue} tooltip={c.reviewQueueHelp} />
                </h2>
                <div className="muted small">{c.reviewQueueHelp}</div>
              </div>
              <div className="pills">
                <span className="pill pill-status pill-status-review">{panel.pendingReview.length}</span>
              </div>
            </div>
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
            <div className="section-head">
              <div>
                <h2 className="h2">
                  <LabelWithTooltip label={c.finalQueue} tooltip={c.finalQueueHelp} />
                </h2>
                <div className="muted small">{c.finalQueueHelp}</div>
              </div>
              <div className="pills">
                <span className="pill pill-status pill-status-approved">{panel.finalApprovals.length}</span>
              </div>
            </div>
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
