import Link from "next/link";
import { getRequestLang } from "@/i18n/server";
import { requireActiveUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import { getHrProcessDetail } from "@/server/hr";
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
  updateHrProcessMetaAction
} from "../actions";
import { IconArrowLeft, IconArrowRight, IconCheckCircle, IconClock, IconPdf, IconPlus, IconTrash } from "@/components/icons";

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
  const branding = await getBrandingSettings();

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
  const screened = process.candidates.filter((candidate) => candidate.status !== "NEW_APPLICANT").length;
  const secondRound = process.candidates.filter((candidate) =>
    ["INTERVIEW_SCHEDULED", "SECOND_ROUND_COMPLETED", "WAITING_FINAL_APPROVAL", "APPROVED_FOR_EMPLOYMENT"].includes(candidate.status)
  ).length;
  const approved = process.candidates.filter((candidate) => candidate.status === "APPROVED_FOR_EMPLOYMENT").length;

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
                <h1 className="brand-title">{process.positionTitle}</h1>
                <p className="muted">{c.subtitle}</p>
              </div>
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
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <section className="panel stack">
          <h2 className="h2">{c.processMeta}</h2>
          <div className="grid4 hr-metric-grid">
            <div className="item">
              <div className="process-card-label">{c.headcount}</div>
              <div className="process-card-value">{process.requestedHeadcount}</div>
            </div>
            <div className="item">
              <div className="process-card-label">Applicants</div>
              <div className="process-card-value">{applicants}</div>
            </div>
            <div className="item">
              <div className="process-card-label">Second round</div>
              <div className="process-card-value">{secondRound}</div>
            </div>
            <div className="item">
              <div className="process-card-label">Approved</div>
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
                {process.finalApprover?.name || c.noValue}
              </span>
            </div>
            <button className="button button-secondary" type="submit">
              {c.saveProcess}
            </button>
          </form>

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
          <h2 className="h2">{c.addCandidate}</h2>
          <div className="muted small">{c.addCandidateHint}</div>
          <form className="stack" action={addCandidateToProcessAction}>
            <input type="hidden" name="processId" value={process.id} />
            <div className="grid2">
              <label className="field">
                <span className="label">{c.existingCandidate}</span>
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
                <span className="label">{c.cv}</span>
                <input className="input" name="cvFile" type="file" accept="application/pdf,.pdf" />
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
          <h2 className="h2">{c.candidates}</h2>
          <div className="list">
            {process.candidates.map((application) => (
              <div key={application.id} className="item stack">
                <div className="item-top">
                  <div>
                    <div className="item-title">{application.candidate.fullName}</div>
                    <div className="muted small">
                      {application.candidate.email || c.noValue} · {application.candidate.phone || c.noValue} · {application.source || application.candidate.source || c.noValue}
                    </div>
                    <div className="muted small">
                      {c.createdAt}: {formatDate(application.appliedAt, lang, true)} · {c.status}: {application.status}
                    </div>
                  </div>
                  <div className="pills">
                    <span className={statusClass(application.status)}>{application.status}</span>
                    {application.candidate.latestCvFileName ? (
                      <a className="button button-secondary" href={`/api/hr/candidate-cv/${application.candidate.id}`} target="_blank" rel="noreferrer">
                        <IconPdf size={18} /> {c.openCv}
                      </a>
                    ) : null}
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
                    <div className="item-title">Workflow</div>

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
            ))}
            {process.candidates.length === 0 ? <div className="muted small">{c.noCandidates}</div> : null}
          </div>
        </section>

        <section className="panel stack">
          <h2 className="h2">{c.audit}</h2>
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
