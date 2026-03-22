import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { getRequestLang } from "@/i18n/server";
import { requireActiveUser } from "@/server/current-user";
import { getHrProcessDetail } from "@/server/hr";
import { getCandidateStageSummary, getProcessWorkflowSummary, type HrNextActionKey, type HrStageKey, type HrWaitingOnKey } from "@/server/hr-presentation";
import UserMenu from "../../dashboard/UserMenu";
import {
  addCandidateToProcessAction,
  archiveCandidateAction,
  cancelHrProcessAction,
  closeHrProcessAction,
  finalApprovalAction,
  hrScreenCandidateAction,
  managerReviewCandidateAction,
  scheduleInterviewAction,
  secondRoundDecisionAction,
  updateHrProcessMetaAction,
  reviewHiringRequestAction
} from "../actions";
import { IconArrowLeft, IconCheckCircle, IconClock, IconPdf, IconPlus, IconTrash, IconUsers } from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "HR proces",
      subtitle: "Detalj pozicije, kandidata, komentara i odobravanja.",
      noAccess: "Nemaš pristup ovom procesu.",
      back: "Nazad na HR System",
      processMeta: "Pozicija i tok procesa",
      candidates: "Kandidati i workflow",
      addCandidate: "Dodaj kandidata",
      addCandidateHint: "Možeš uneti novog kandidata ili iskoristiti postojeći profil iz baze.",
      existingCandidate: "Postojeći kandidat",
      fullName: "Ime i prezime",
      email: "Email",
      phone: "Telefon",
      linkedIn: "LinkedIn / portfolio",
      source: "Izvor prijave",
      appliedAt: "Datum prijave",
      hrComment: "HR komentar",
      screeningNote: "Komentar prvog kruga",
      screeningResult: "Rezultat inicijalnog razgovora / razlog",
      cv: "PDF CV",
      add: "Dodaj kandidata",
      status: "Status",
      position: "Pozicija",
      team: "Tim",
      manager: "Menadžer sektora",
      finalApprover: "Finalni odobravalac",
      headcount: "Broj izvršilaca",
      priority: "Prioritet",
      reason: "Razlog",
      note: "Napomena",
      adChannel: "Kanal oglasa",
      adPublishedAt: "Datum objave oglasa",
      saveProcess: "Sačuvaj proces",
      closeProcess: "Zatvori proces",
      cancelProcess: "Otkaži proces",
      reasonRequired: "Obavezan razlog",
      comments: "Komentari i istorija",
      audit: "Audit trail",
      noCandidates: "Još nema kandidata za ovu poziciju.",
      noAudit: "Još nema audit zapisa.",
      hrScreening: "HR screening",
      managerReview: "Pregled menadžera",
      scheduleInterview: "Zakazivanje drugog kruga",
      secondRound: "Ishod drugog kruga",
      finalApproval: "Finalno odobrenje",
      archive: "Arhiviraj kandidata",
      cancel: "Otkaži kandidata",
      openCv: "Otvori CV",
      submit: "Sačuvaj",
      approve: "Odobri",
      reject: "Odbij",
      advance: "Prosledi dalje",
      proposedSlots: "Predloženi termini (jedan po redu)",
      interviewAt: "Termin intervjua",
      finalComment: "Finalni komentar",
      managerComment: "Komentar menadžera",
      mark: "Akcija",
      from: "Otvorio",
      createdAt: "Kreirano",
      requestedStart: "Željeni početak",
      requestType: "Tip zahteva",
      superiorComment: "Komentar nadređenog",
      approveRequest: "Odobrenje zahteva",
      reviewComment: "Komentar odobrenja",
      cvDriveLink: "CV Drive link",
      currentPhase: "Trenutna faza",
      waitingOn: "Na potezu je",
      nextAction: "Sledeći korak",
      systemStatus: "Sistemski status",
      workflowGuide: "Vodič kroz proces",
      workflowGuideText: "Isti workflow, ali jasnije prikazan: zahtev → HR screening → pregled menadžera → intervju / drugi krug → finalna odluka → onboarding.",
      stageGuide: "Kandidatov sledeći korak",
      stageGuideText: "Gledaj fazu, ko je na potezu i sledeću akciju. To je najbrži način da razumeš šta sada treba uraditi.",
      noValue: "—"
    };
  }

  return {
    title: "HR process",
    subtitle: "Position detail, candidates, comments and approvals.",
    noAccess: "You do not have access to this process.",
    back: "Back to HR System",
    processMeta: "Position and workflow",
    candidates: "Candidates and workflow",
    addCandidate: "Add candidate",
    addCandidateHint: "You can add a new candidate or reuse an existing profile from the base.",
    existingCandidate: "Existing candidate",
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    linkedIn: "LinkedIn / portfolio",
    source: "Source",
    appliedAt: "Application date",
    hrComment: "HR comment",
    screeningNote: "First round note",
    screeningResult: "Initial interview result / reason",
    cv: "PDF CV",
    add: "Add candidate",
    status: "Status",
    position: "Position",
    team: "Team",
    manager: "Sector manager",
    finalApprover: "Final approver",
    headcount: "Headcount",
    priority: "Priority",
    reason: "Reason",
    note: "Note",
    adChannel: "Ad channel",
    adPublishedAt: "Ad published at",
    saveProcess: "Save process",
    closeProcess: "Close process",
    cancelProcess: "Cancel process",
    reasonRequired: "Required reason",
    comments: "Comments and history",
    audit: "Audit trail",
    noCandidates: "No candidates for this position yet.",
    noAudit: "No audit entries yet.",
    hrScreening: "HR screening",
    managerReview: "Manager review",
    scheduleInterview: "Schedule second round",
    secondRound: "Second round outcome",
    finalApproval: "Final approval",
    archive: "Archive candidate",
    cancel: "Cancel candidate",
    openCv: "Open CV",
    submit: "Save",
    approve: "Approve",
    reject: "Reject",
    advance: "Advance",
    proposedSlots: "Proposed time slots (one per line)",
    interviewAt: "Interview time",
    finalComment: "Final comment",
    managerComment: "Manager comment",
    mark: "Action",
    from: "Opened by",
    createdAt: "Created",
    requestedStart: "Desired start",
    requestType: "Request type",
    superiorComment: "Superior comment",
    approveRequest: "Request approval",
    reviewComment: "Approval comment",
    cvDriveLink: "CV Drive link",
    currentPhase: "Current phase",
    waitingOn: "Waiting on",
    nextAction: "Next action",
    systemStatus: "System status",
    workflowGuide: "Workflow guide",
    workflowGuideText: "The same workflow, shown more clearly: request → HR screening → manager review → interview / round 2 → final decision → onboarding.",
    stageGuide: "Candidate next step",
    stageGuideText: "Focus on the phase, who owns the step, and the next action. That is the fastest way to understand what happens now.",
    noValue: "—"
  };
}

function statusClass(status: string) {
  const value = String(status || "").toUpperCase();
  if (["APPROVED", "APPROVED_FOR_EMPLOYMENT", "CLOSED", "ARCHIVED"].includes(value)) {
    return "pill pill-status pill-status-approved";
  }
  if (["OPEN", "IN_PROGRESS", "ON_HOLD", "INTERVIEW_SCHEDULED", "WAITING_FINAL_APPROVAL"].includes(value)) {
    return "pill pill-status pill-status-progress";
  }
  if (["WAITING_MANAGER_REVIEW", "SENT_TO_MANAGER", "HR_SCREENING", "SECOND_ROUND_COMPLETED"].includes(value)) {
    return "pill pill-status pill-status-review";
  }
  if (["CANCELED", "REJECTED_BY_HR", "REJECTED_BY_MANAGER", "REJECTED_FINAL"].includes(value)) {
    return "pill pill-status pill-status-rejected";
  }
  return "pill pill-status pill-status-muted";
}

function formatDate(value: Date | string | null | undefined, lang: "sr" | "en", withTime = false) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "sr" ? "sr-RS" : "en-GB", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {})
  }).format(date);
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
  if (waitingOn === "HR") return "HR";
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

export default async function HrProcessPage({
  params,
  searchParams
}: {
  params: { processId: string };
  searchParams: { success?: string; error?: string };
}) {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const c = copy(lang);

  const detail = await getHrProcessDetail(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hrAddon: user.hrAddon,
      teamId: user.teamId,
      managerId: user.managerId
    },
    params.processId
  );

  if (!detail.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{c.noAccess}</div>
          <Link className="button button-secondary" href="/hr">
            <IconArrowLeft size={18} /> {c.back}
          </Link>
        </div>
      </main>
    );
  }

  const process = detail.process;
  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;
  const applicants = process.candidates.length;
  const secondRound = process.candidates.filter((candidate) =>
    ["INTERVIEW_SCHEDULED", "SECOND_ROUND_COMPLETED", "WAITING_FINAL_APPROVAL", "APPROVED_FOR_EMPLOYMENT"].includes(candidate.status)
  ).length;
  const approved = process.candidates.filter((candidate) => candidate.status === "APPROVED_FOR_EMPLOYMENT").length;
  const processSummary = getProcessWorkflowSummary(process);
  const workflowSteps: HrStageKey[] = [
    "REQUEST_APPROVAL",
    "READY_FOR_HR",
    "MANAGER_REVIEW",
    "ROUND_TWO",
    "FINAL_DECISION",
    "APPROVED_FOR_HIRE"
  ];

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div>
              <h1 className="brand-title">{process.positionTitle}</h1>
              <p className="muted">{c.subtitle}</p>
            </div>
            <div className="inline">
              <Link className="button button-secondary" href="/hr">
                <IconArrowLeft size={18} /> {c.back}
              </Link>
              <span className={statusClass(process.status)}>{process.status}</span>
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
                label={c.processMeta}
                tooltip={
                  lang === "sr"
                    ? "Ovo je centralni pregled procesa. Gledaj prvu liniju sa fazom i sledećim korakom pre nego što ulaziš u pojedinačne kandidate."
                    : "This is the central process overview. Check the phase and next-action row first before going into individual candidates."
                }
              />
            </h2>
          </div>
          <div className="grid4 hr-metric-grid">
            <div className={toneClass(processSummary.tone)}>
              <div className="process-card-body">
                <div className="process-card-label">{c.currentPhase}</div>
                <div className="item-title">{stageLabel(lang, processSummary.stageKey)}</div>
              </div>
            </div>
            <div className="process-card process-card-muted">
              <div className="process-card-body">
                <div className="process-card-label">{c.waitingOn}</div>
                <div className="item-title">
                  {waitingOnLabel(lang, processSummary.waitingOn, {
                    manager: process.manager?.name,
                    finalApprover: process.finalApprover?.name
                  })}
                </div>
              </div>
            </div>
            <div className="process-card process-card-muted">
              <div className="process-card-body">
                <div className="process-card-label">{c.nextAction}</div>
                <div className="muted small">{nextActionLabel(lang, processSummary.nextAction)}</div>
              </div>
            </div>
            <div className="process-card process-card-muted">
              <div className="process-card-body">
                <div className="process-card-label">{c.systemStatus}</div>
                <div className="item-title">{process.status}</div>
              </div>
            </div>
          </div>
          <div className="workflow-strip">
            {workflowSteps.map((step, index) => (
              <div key={step} className={`workflow-step${processSummary.stageKey === step ? " is-active" : ""}`}>
                <div className="workflow-step-index">{index + 1}</div>
                <div className="flow-step-copy">
                  <div className="flow-step-title">{stageLabel(lang, step)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="notice notice-info">
            <div className="notice-icon"><IconUsers size={18} /></div>
            <div>
              <div className="item-title">{c.workflowGuide}</div>
              <div className="muted small">{c.workflowGuideText}</div>
            </div>
          </div>
          <div className="grid4 hr-metric-grid">
            <div className="item">
              <div className="process-card-label">{c.headcount}</div>
              <div className="process-card-value">{process.requestedHeadcount}</div>
            </div>
            <div className="item">
              <div className="process-card-label">{lang === "sr" ? "Prijavljeni" : "Applicants"}</div>
              <div className="process-card-value">{applicants}</div>
            </div>
            <div className="item">
              <div className="process-card-label">{c.secondRound}</div>
              <div className="process-card-value">{secondRound}</div>
            </div>
            <div className="item">
              <div className="process-card-label">{lang === "sr" ? "Odobreni" : "Approved"}</div>
              <div className="process-card-value">{approved}</div>
            </div>
          </div>

          <form className="stack" action={updateHrProcessMetaAction}>
            <input type="hidden" name="processId" value={process.id} />
            <div className="grid3">
              <label className="field">
                <span className="label">{c.status}</span>
                <select className="input" name="status" defaultValue={process.status}>
                  {["DRAFT", "OPEN", "IN_PROGRESS", "ON_HOLD", "APPROVED", "CLOSED", "CANCELED"].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">{c.adChannel}</span>
                <input className="input" name="adChannel" type="text" defaultValue={process.adChannel || ""} />
              </label>
              <label className="field">
                <span className="label">{c.adPublishedAt}</span>
                <input
                  className="input"
                  name="adPublishedAt"
                  type="datetime-local"
                  defaultValue={process.adPublishedAt ? new Date(process.adPublishedAt).toISOString().slice(0, 16) : ""}
                />
              </label>
            </div>
            <div className="grid2">
              <label className="field">
                <span className="label">{c.reason}</span>
                <textarea className="input" rows={3} value={process.reason} readOnly />
              </label>
              <label className="field">
                <span className="label">{c.note}</span>
                <textarea className="input" name="note" rows={3} defaultValue={process.note || ""} />
              </label>
            </div>
            <div className="inline">
              <span className="muted small">
                {c.team}: {process.team?.name || c.noValue} · {c.manager}: {process.manager?.name || c.noValue} · {c.finalApprover}:{" "}
                {process.finalApprover?.name || c.noValue} · {c.requestType}: {process.requestType || c.noValue} · {c.requestedStart}:{" "}
                {formatDate(process.desiredStartDate, lang)} · {c.from}: {process.openedBy?.name || c.noValue}
              </span>
            </div>
            <button className="button button-secondary" type="submit">
              {c.saveProcess}
            </button>
          </form>

          {detail.permissions.canApproveRequest ? (
            <form className="stack" action={reviewHiringRequestAction}>
              <input type="hidden" name="processId" value={process.id} />
              <div className="grid2">
                <label className="field">
                  <span className="label">{c.approveRequest}</span>
                  <select className="input" name="decision" defaultValue="APPROVE">
                    <option value="APPROVE">{c.approve}</option>
                    <option value="REJECT">{c.reject}</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">{c.reviewComment}</span>
                  <input className="input" name="comment" type="text" defaultValue={process.superiorComment || ""} />
                </label>
              </div>
              <button className="button" type="submit">{c.submit}</button>
            </form>
          ) : process.superiorComment ? (
            <div className="notice notice-info">
              <div>
                <div className="item-title">{c.superiorComment}</div>
                <div className="muted small">{process.superiorComment}</div>
              </div>
            </div>
          ) : null}

          <div className="grid2">
            <form className="stack" action={closeHrProcessAction}>
              <input type="hidden" name="processId" value={process.id} />
              <label className="field">
                <span className="label">{c.note}</span>
                <input className="input" name="note" type="text" placeholder={c.closeProcess} />
              </label>
              <button className="button button-secondary" type="submit">
                <IconCheckCircle size={18} /> {c.closeProcess}
              </button>
            </form>

            <form className="stack" action={cancelHrProcessAction}>
              <input type="hidden" name="processId" value={process.id} />
              <label className="field">
                <span className="label">{c.reasonRequired}</span>
                <input className="input" name="reason" type="text" required />
              </label>
              <button className="button button-danger" type="submit">
                <IconTrash size={18} /> {c.cancelProcess}
              </button>
            </form>
          </div>
        </section>

        <section className="panel stack">
          <div className="section-copy">
            <h2 className="h2">
              <LabelWithTooltip
                label={c.addCandidate}
                tooltip={
                  lang === "sr"
                    ? "Dodaj novog kandidata ili poveži postojećeg iz baze. Drive link za CV je dovoljan — nema potrebe da čuvaš fajl u bazi."
                    : "Add a new candidate or reuse an existing one from the base. A Drive link for the CV is enough — there is no need to store heavy files in the database."
                }
              />
            </h2>
            <p className="muted small">{c.addCandidateHint}</p>
          </div>
          <form className="stack" action={addCandidateToProcessAction}>
            <input type="hidden" name="processId" value={process.id} />
            <div className="grid2">
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.existingCandidate}
                    tooltip={
                      lang === "sr"
                        ? "Ako kandidat već postoji u bazi, samo ga poveži sa ovim procesom umesto da praviš novi profil."
                        : "If the candidate already exists in the base, simply attach that profile to this process instead of creating a duplicate."
                    }
                  />
                </span>
                <select className="input" name="candidateId" defaultValue="">
                  <option value="">{c.noValue}</option>
                  {detail.existingCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName} {candidate.email ? `(${candidate.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">{c.fullName}</span>
                <input className="input" name="fullName" type="text" />
              </label>
            </div>
            <div className="grid3">
              <label className="field">
                <span className="label">{c.email}</span>
                <input className="input" name="email" type="email" />
              </label>
              <label className="field">
                <span className="label">{c.phone}</span>
                <input className="input" name="phone" type="text" />
              </label>
              <label className="field">
                <span className="label">{c.source}</span>
                <input className="input" name="source" type="text" />
              </label>
            </div>
            <div className="grid3">
              <label className="field">
                <span className="label">{c.linkedIn}</span>
                <input className="input" name="linkedIn" type="text" />
              </label>
              <label className="field">
                <span className="label">{c.appliedAt}</span>
                <input className="input" name="appliedAt" type="datetime-local" />
              </label>
              <label className="field">
                <span className="label">
                  <LabelWithTooltip
                    label={c.cvDriveLink}
                    tooltip={
                      lang === "sr"
                        ? "Sačuvaj Google Drive link ka CV-u, da dokument ostane van baze i lako se deli u procesu."
                        : "Store the Google Drive link to the CV so the document stays outside the database and remains easy to share through the process."
                    }
                  />
                </span>
                <input className="input" name="cvDriveUrl" type="url" placeholder="https://drive.google.com/..." />
              </label>
            </div>
            <div className="grid3">
              <label className="field">
                <span className="label">{c.hrComment}</span>
                <textarea className="input" name="hrComment" rows={3} />
              </label>
              <label className="field">
                <span className="label">{c.screeningNote}</span>
                <textarea className="input" name="firstRoundComment" rows={3} />
              </label>
              <label className="field">
                <span className="label">{c.screeningResult}</span>
                <textarea className="input" name="screeningResult" rows={3} />
              </label>
            </div>
            <button className="button" type="submit">
              <IconPlus size={18} /> {c.add}
            </button>
          </form>
        </section>

        <section className="panel stack">
          <div className="section-copy">
            <h2 className="h2">
              <LabelWithTooltip
                label={c.candidates}
                tooltip={
                  lang === "sr"
                    ? "Svaki kandidat dobija jasan prikaz faze, komentara i sledeće akcije, da ne moraš da čitaš ceo audit kako bi znao šta je stanje."
                    : "Each candidate gets a clear view of the phase, comments, and next action so you do not have to read the full audit trail just to understand the state."
                }
              />
            </h2>
            <p className="muted small">{c.stageGuideText}</p>
          </div>
          <div className="list">
            {process.candidates.map((application) => {
              const candidateFlow = getCandidateStageSummary(application);
              return (
                <div key={application.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{application.candidate.fullName}</div>
                      <div className="muted small">
                        {application.candidate.email || c.noValue} · {application.candidate.phone || c.noValue} ·{" "}
                        {application.source || application.candidate.source || c.noValue}
                      </div>
                      <div className="muted small">
                        {c.createdAt}: {formatDate(application.appliedAt, lang, true)} · {c.status}: {application.status}
                      </div>
                    </div>
                    <div className="pills">
                      <span className={statusClass(application.status)}>{application.status}</span>
                      {application.candidate.cvDriveUrl ? (
                        <a className="button button-secondary" href={application.candidate.cvDriveUrl} target="_blank" rel="noreferrer">
                          <IconPdf size={18} /> {c.cvDriveLink}
                        </a>
                      ) : null}
                      {application.candidate.latestCvFileName ? (
                        <a className="button button-secondary" href={`/api/hr/candidate-cv/${application.candidate.id}`} target="_blank" rel="noreferrer">
                          <IconPdf size={18} /> {c.openCv}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid4 hr-metric-grid">
                    <div className={toneClass(candidateFlow.tone)}>
                      <div className="process-card-body">
                        <div className="process-card-label">{c.currentPhase}</div>
                        <div className="item-title">{stageLabel(lang, candidateFlow.stageKey)}</div>
                      </div>
                    </div>
                    <div className="process-card process-card-muted">
                      <div className="process-card-body">
                        <div className="process-card-label">{c.waitingOn}</div>
                        <div className="item-title">
                          {waitingOnLabel(lang, candidateFlow.waitingOn, {
                            manager: process.manager?.name,
                            finalApprover: process.finalApprover?.name
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="process-card process-card-muted">
                      <div className="process-card-body">
                        <div className="process-card-label">{c.nextAction}</div>
                        <div className="muted small">{nextActionLabel(lang, candidateFlow.nextAction)}</div>
                      </div>
                    </div>
                    <div className="process-card process-card-muted">
                      <div className="process-card-body">
                        <div className="process-card-label">{c.systemStatus}</div>
                        <div className="item-title">{application.status}</div>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(application.managerProposedSlots) && application.managerProposedSlots.length ? (
                    <div className="notice notice-info">
                      <div className="notice-icon"><IconClock size={18} /></div>
                      <div>
                        <div className="item-title">{c.proposedSlots}</div>
                        <div className="muted small">{application.managerProposedSlots.join(" · ")}</div>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid2 hr-comment-grid">
                    <div className="item stack">
                      <div className="item-title">{c.comments}</div>
                      <div className="list hr-mini-list">
                        {application.comments.map((comment) => (
                          <div key={comment.id} className="item stack">
                            <div className="muted small">
                              {comment.stage} · {comment.actor?.name || c.noValue} · {formatDate(comment.createdAt, lang, true)}
                            </div>
                            <div>{comment.body}</div>
                          </div>
                        ))}
                        {application.comments.length === 0 ? <div className="muted small">{c.noValue}</div> : null}
                      </div>
                    </div>

                    <div className="item stack">
                      <div className="item-title">
                        <LabelWithTooltip
                          label="Workflow"
                          tooltip={
                            lang === "sr"
                              ? "Prikazane su samo akcije koje korisnik sa trenutnim pristupom zaista može da uradi u ovoj fazi."
                              : "Only the actions available to the current user and the current phase are shown here."
                          }
                        />
                      </div>

                      {detail.permissions.canHrManage && ["NEW_APPLICANT", "HR_SCREENING"].includes(application.status) ? (
                        <form className="stack" action={hrScreenCandidateAction}>
                          <input type="hidden" name="processId" value={process.id} />
                          <input type="hidden" name="applicationId" value={application.id} />
                          <div className="grid2">
                            <label className="field">
                              <span className="label">{c.mark}</span>
                              <select className="input" name="decision" defaultValue="SEND_TO_MANAGER">
                                <option value="SEND_TO_MANAGER">{c.advance}</option>
                                <option value="REJECT">{c.reject}</option>
                              </select>
                            </label>
                            <label className="field">
                              <span className="label">{c.screeningResult}</span>
                              <input className="input" name="screeningResult" type="text" defaultValue={application.screeningResult || ""} />
                            </label>
                          </div>
                          <label className="field">
                            <span className="label">{c.hrComment}</span>
                            <textarea className="input" name="hrComment" rows={2} defaultValue={application.hrComment || ""} />
                          </label>
                          <label className="field">
                            <span className="label">{c.screeningNote}</span>
                            <textarea className="input" name="firstRoundComment" rows={2} defaultValue={application.firstRoundComment || ""} />
                          </label>
                          <button className="button button-secondary" type="submit">{c.submit}</button>
                        </form>
                      ) : null}

                      {detail.permissions.canManagerReview && application.status === "WAITING_MANAGER_REVIEW" ? (
                        <form className="stack" action={managerReviewCandidateAction}>
                          <input type="hidden" name="processId" value={process.id} />
                          <input type="hidden" name="applicationId" value={application.id} />
                          <div className="grid2">
                            <label className="field">
                              <span className="label">{c.mark}</span>
                              <select className="input" name="decision" defaultValue="ADVANCE">
                                <option value="ADVANCE">{c.advance}</option>
                                <option value="REJECT">{c.reject}</option>
                              </select>
                            </label>
                            <label className="field">
                              <span className="label">{c.managerComment}</span>
                              <input className="input" name="managerComment" type="text" defaultValue={application.managerComment || ""} />
                            </label>
                          </div>
                          <label className="field">
                            <span className="label">{c.proposedSlots}</span>
                            <textarea className="input" name="proposedSlots" rows={3} placeholder="2026-03-22 10:00&#10;2026-03-23 14:00" />
                          </label>
                          <button className="button button-secondary" type="submit">{c.submit}</button>
                        </form>
                      ) : null}

                      {detail.permissions.canHrManage && application.status === "SENT_TO_MANAGER" ? (
                        <form className="stack" action={scheduleInterviewAction}>
                          <input type="hidden" name="processId" value={process.id} />
                          <input type="hidden" name="applicationId" value={application.id} />
                          <label className="field">
                            <span className="label">{c.interviewAt}</span>
                            <input className="input" name="interviewAt" type="datetime-local" required />
                          </label>
                          <label className="field">
                            <span className="label">{c.hrComment}</span>
                            <textarea className="input" name="hrComment" rows={2} defaultValue={application.hrComment || ""} />
                          </label>
                          <button className="button button-secondary" type="submit">{c.scheduleInterview}</button>
                        </form>
                      ) : null}

                      {detail.permissions.canManagerReview && application.status === "INTERVIEW_SCHEDULED" ? (
                        <form className="stack" action={secondRoundDecisionAction}>
                          <input type="hidden" name="processId" value={process.id} />
                          <input type="hidden" name="applicationId" value={application.id} />
                          <label className="field">
                            <span className="label">{c.mark}</span>
                            <select className="input" name="decision" defaultValue="FINAL_APPROVAL">
                              <option value="FINAL_APPROVAL">{c.advance}</option>
                              <option value="REJECT">{c.reject}</option>
                            </select>
                          </label>
                          <label className="field">
                            <span className="label">{c.managerComment}</span>
                            <textarea className="input" name="managerComment" rows={2} defaultValue={application.managerComment || ""} />
                          </label>
                          <button className="button button-secondary" type="submit">{c.secondRound}</button>
                        </form>
                      ) : null}

                      {detail.permissions.canFinalApprove && application.status === "WAITING_FINAL_APPROVAL" ? (
                        <form className="stack" action={finalApprovalAction}>
                          <input type="hidden" name="processId" value={process.id} />
                          <input type="hidden" name="applicationId" value={application.id} />
                          <label className="field">
                            <span className="label">{c.mark}</span>
                            <select className="input" name="decision" defaultValue="APPROVE">
                              <option value="APPROVE">{c.approve}</option>
                              <option value="REJECT">{c.reject}</option>
                            </select>
                          </label>
                          <label className="field">
                            <span className="label">{c.finalComment}</span>
                            <textarea className="input" name="finalComment" rows={2} defaultValue={application.finalComment || ""} />
                          </label>
                          <button className="button button-secondary" type="submit">{c.finalApproval}</button>
                        </form>
                      ) : null}

                      {detail.permissions.canHrManage ? (
                        <div className="grid2">
                          <form className="stack" action={archiveCandidateAction}>
                            <input type="hidden" name="processId" value={process.id} />
                            <input type="hidden" name="applicationId" value={application.id} />
                            <input type="hidden" name="mode" value="ARCHIVED" />
                            <label className="field">
                              <span className="label">{c.reasonRequired}</span>
                              <input className="input" name="reason" type="text" required />
                            </label>
                            <button className="button button-secondary" type="submit">{c.archive}</button>
                          </form>
                          <form className="stack" action={archiveCandidateAction}>
                            <input type="hidden" name="processId" value={process.id} />
                            <input type="hidden" name="applicationId" value={application.id} />
                            <input type="hidden" name="mode" value="CANCELED" />
                            <label className="field">
                              <span className="label">{c.reasonRequired}</span>
                              <input className="input" name="reason" type="text" required />
                            </label>
                            <button className="button button-danger" type="submit">{c.cancel}</button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {process.candidates.length === 0 ? <div className="muted small">{c.noCandidates}</div> : null}
          </div>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <div>
              <h2 className="h2">
                <LabelWithTooltip
                  label={c.audit}
                  tooltip={
                    lang === "sr"
                      ? "Audit prikazuje ključne promene po procesu: ko je ostavio komentar, promenio status ili doneo odluku i kada se to desilo."
                      : "The audit trail shows the key process changes: who commented, changed status, or made a decision, and when it happened."
                  }
                />
              </h2>
              <div className="muted small">
                {lang === "sr"
                  ? "Koristan pregled za vraćanje konteksta bez ulaska u svaku pojedinačnu rundu."
                  : "A helpful context view so you can understand the history without opening every round separately."}
              </div>
            </div>
            <div className="pills">
              <span className="pill pill-status pill-status-muted">{process.auditLogs.length}</span>
            </div>
          </div>
          <div className="list">
            {process.auditLogs.map((log) => (
              <div key={log.id} className="item stack">
                <div className="item-top">
                  <div className="item-title">{log.action}</div>
                  <span className="pill">{formatDate(log.createdAt, lang, true)}</span>
                </div>
                <div className="muted small">
                  {log.actor?.name || c.noValue} · {log.field || c.noValue} · {log.oldValue || c.noValue} → {log.newValue || c.noValue}
                </div>
                {log.comment ? <div>{log.comment}</div> : null}
              </div>
            ))}
            {process.auditLogs.length === 0 ? <div className="muted small">{c.noAudit}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
