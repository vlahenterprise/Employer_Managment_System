import type { HrCandidateStatus, HrProcessStatus } from "@prisma/client";

export type Lang = "sr" | "en";

export type HrOwnerKey = "HR" | "MANAGER" | "SUPERIOR" | "FINAL_APPROVER" | "SYSTEM" | "NONE";

export type HrSemanticProcessKey =
  | "REQUEST_DRAFT"
  | "PENDING_APPROVAL"
  | "READY_FOR_HR"
  | "ACTIVE_HIRING"
  | "ON_HOLD"
  | "FILLED"
  | "CLOSED"
  | "CANCELED";

export type HrSemanticCandidateKey =
  | "NEW"
  | "SCREENING"
  | "MANAGER_REVIEW"
  | "INTERVIEW"
  | "FINAL_DECISION"
  | "APPROVED"
  | "ON_HOLD"
  | "REJECTED"
  | "ARCHIVED";

export type HrWorkflowTone = "muted" | "pending" | "review" | "progress" | "approved" | "rejected";

export const HIRING_REQUEST_TYPES = [
  { value: "FULL_TIME", sr: "Full time", en: "Full time" },
  { value: "PART_TIME", sr: "Part time", en: "Part time" },
  { value: "OCCASIONAL", sr: "Povremeno", en: "Occasional" },
  { value: "EXTERNAL_CONTRACTOR", sr: "Eksterni saradnik", en: "External contractor" }
] as const;

export const CANDIDATE_SOURCE_OPTIONS = [
  { value: "REFERRAL", group: "REFERRAL", sr: "Preporuka", en: "Referral" },
  { value: "INTERNAL_REFERRAL", group: "REFERRAL", sr: "Interna preporuka", en: "Internal referral" },
  { value: "INFOSTUD", group: "JOB_BOARD", sr: "InfoStud", en: "InfoStud" },
  { value: "LINKEDIN", group: "SOCIAL", sr: "LinkedIn", en: "LinkedIn" },
  { value: "INSTAGRAM", group: "SOCIAL", sr: "Instagram", en: "Instagram" },
  { value: "FACEBOOK", group: "SOCIAL", sr: "Facebook", en: "Facebook" },
  { value: "GOOGLE_ADS", group: "PAID", sr: "Google Ads", en: "Google Ads" },
  { value: "META_ADS", group: "PAID", sr: "Meta Ads", en: "Meta Ads" },
  { value: "INTERNAL_HIRING", group: "INTERNAL", sr: "Interno zapošljavanje", en: "Internal hiring" },
  { value: "OTHER", group: "OTHER", sr: "Ostalo", en: "Other" }
] as const;

export const CANDIDATE_SENIORITY_OPTIONS = ["JUNIOR", "MEDIOR", "SENIOR", "LEAD", "MANAGER"] as const;
export const CANDIDATE_LANGUAGE_OPTIONS = ["SR", "EN", "SR_EN", "OTHER"] as const;

export const REJECTION_REASONS = [
  { value: "INSUFFICIENT_EXPERIENCE", sr: "Nema dovoljno iskustva", en: "Insufficient experience" },
  { value: "SALARY_TOO_HIGH", sr: "Preskupa plata", en: "Salary expectation too high" },
  { value: "COMMUNICATION", sr: "Loša komunikacija", en: "Communication concern" },
  { value: "ROLE_FIT", sr: "Nije fit za ulogu", en: "Not a role fit" },
  { value: "CANDIDATE_WITHDREW", sr: "Kandidat odustao", en: "Candidate withdrew" },
  { value: "OTHER", sr: "Ostalo", en: "Other" }
] as const;

export const HR_RECOMMENDATIONS = [
  { value: "SEND_TO_MANAGER", sr: "Prosledi menadžeru", en: "Send to manager" },
  { value: "HOLD", sr: "Zadrži / hold", en: "Hold" },
  { value: "REJECT", sr: "Odbij", en: "Reject" }
] as const;

export const MANAGER_RECOMMENDATIONS = [
  { value: "ADVANCE", sr: "Prosledi dalje", en: "Advance" },
  { value: "HOLD", sr: "Možda / hold", en: "Maybe / hold" },
  { value: "REJECT", sr: "Odbij", en: "Reject" }
] as const;

export const FINAL_REASON_CODES = [
  { value: "APPROVED_FOR_EMPLOYMENT", sr: "Odobren za zaposlenje", en: "Approved for employment" },
  { value: "APPROVED_PENDING_OFFER", sr: "Odobren, čeka ponudu", en: "Approved, pending offer" },
  { value: "OFFER_SENT", sr: "Ponuda poslata", en: "Offer sent" },
  { value: "CANDIDATE_DECLINED", sr: "Kandidat odbio", en: "Candidate declined" },
  { value: "REJECTED", sr: "Odbijen", en: "Rejected" },
  { value: "OTHER", sr: "Ostalo", en: "Other" }
] as const;

function text(lang: Lang, sr: string, en: string) {
  return lang === "sr" ? sr : en;
}

export function optionLabel(options: readonly { value: string; sr: string; en: string }[], value: string | null | undefined, lang: Lang) {
  const found = options.find((option) => option.value === String(value || "").toUpperCase());
  return found ? text(lang, found.sr, found.en) : value || "—";
}

export function getSourceGroup(source: string | null | undefined) {
  const normalized = String(source || "").trim().toUpperCase();
  return CANDIDATE_SOURCE_OPTIONS.find((option) => option.value === normalized)?.group || "OTHER";
}

export function parseLines(value: string | null | undefined) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function scoreAverage(scorecard: unknown) {
  if (!scorecard || typeof scorecard !== "object") return null;
  const values = Object.values(scorecard as Record<string, unknown>)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function getWaitingDays(from: Date | string | null | undefined, now = new Date()) {
  if (!from) return 0;
  const date = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

export function getProcessSemanticMeta(
  process: {
    status: HrProcessStatus | string;
    openedAt?: Date | string | null;
    updatedAt?: Date | string | null;
    superiorDecidedAt?: Date | string | null;
    candidates?: Array<{ status: HrCandidateStatus | string }>;
  },
  lang: Lang
): {
  key: HrSemanticProcessKey;
  label: string;
  owner: HrOwnerKey;
  nextAction: string;
  tone: HrWorkflowTone;
  waitingDays: number;
} {
  const status = String(process.status || "").toUpperCase();
  const activeCandidates = (process.candidates || []).filter((candidate) =>
    !["ARCHIVED", "REJECTED_BY_HR", "REJECTED_BY_MANAGER", "REJECTED_FINAL", "CANCELED"].includes(String(candidate.status || "").toUpperCase())
  );
  const waitingFrom = process.superiorDecidedAt || process.updatedAt || process.openedAt;

  if (status === "DRAFT") {
    return {
      key: "PENDING_APPROVAL",
      label: text(lang, "Čeka odobrenje", "Pending approval"),
      owner: "SUPERIOR",
      nextAction: text(lang, "Nadređeni treba da odobri ili odbije zahtev.", "The superior needs to approve or reject the request."),
      tone: "review",
      waitingDays: getWaitingDays(process.openedAt)
    };
  }

  if (status === "OPEN") {
    return {
      key: "READY_FOR_HR",
      label: text(lang, "Spremno za HR", "Ready for HR"),
      owner: "HR",
      nextAction: text(lang, "HR treba da pokrene screening i doda kandidate.", "HR should start screening and add candidates."),
      tone: "review",
      waitingDays: getWaitingDays(waitingFrom)
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      key: "ACTIVE_HIRING",
      label: text(lang, "Aktivan hiring", "Active hiring"),
      owner: activeCandidates.some((candidate) => String(candidate.status).includes("WAITING_MANAGER") || String(candidate.status).includes("INTERVIEW"))
        ? "MANAGER"
        : "HR",
      nextAction: text(lang, "Prati kandidata koji najduže čeka sledeći korak.", "Follow the candidate waiting longest for the next step."),
      tone: "progress",
      waitingDays: getWaitingDays(waitingFrom)
    };
  }

  if (status === "ON_HOLD") {
    return {
      key: "ON_HOLD",
      label: text(lang, "Na čekanju", "On hold"),
      owner: "SYSTEM",
      nextAction: text(lang, "Proces je pauziran dok ne stigne novi signal.", "The process is paused until a new signal arrives."),
      tone: "muted",
      waitingDays: getWaitingDays(waitingFrom)
    };
  }

  if (status === "APPROVED") {
    return {
      key: "FILLED",
      label: text(lang, "Popunjeno", "Filled"),
      owner: "HR",
      nextAction: text(lang, "Pokreni ili proveri onboarding handoff.", "Start or verify onboarding handoff."),
      tone: "approved",
      waitingDays: 0
    };
  }

  if (status === "CANCELED") {
    return {
      key: "CANCELED",
      label: text(lang, "Otkazano", "Canceled"),
      owner: "NONE",
      nextAction: text(lang, "Nema sledeće akcije.", "No next action."),
      tone: "rejected",
      waitingDays: 0
    };
  }

  return {
    key: "CLOSED",
    label: text(lang, "Zatvoreno", "Closed"),
    owner: "NONE",
    nextAction: text(lang, "Proces ostaje u istoriji.", "The process remains in history."),
    tone: "muted",
    waitingDays: 0
  };
}

export function getCandidateSemanticMeta(
  candidate: {
    status: HrCandidateStatus | string;
    updatedAt?: Date | string | null;
    appliedAt?: Date | string | null;
    lastDecisionAt?: Date | string | null;
  },
  lang: Lang
): {
  key: HrSemanticCandidateKey;
  label: string;
  owner: HrOwnerKey;
  nextAction: string;
  tone: HrWorkflowTone;
  waitingDays: number;
} {
  const status = String(candidate.status || "").toUpperCase();
  const from = candidate.lastDecisionAt || candidate.updatedAt || candidate.appliedAt;

  if (status === "NEW_APPLICANT" || status === "HR_SCREENING") {
    return { key: "SCREENING", label: text(lang, "Screening", "Screening"), owner: "HR", nextAction: text(lang, "HR scorecard i preporuka.", "HR scorecard and recommendation."), tone: "review", waitingDays: getWaitingDays(from) };
  }
  if (status === "ON_HOLD") {
    return { key: "ON_HOLD", label: text(lang, "Hold", "Hold"), owner: "HR", nextAction: text(lang, "Zadrži kandidata za kasniji signal.", "Keep candidate for a later signal."), tone: "muted", waitingDays: getWaitingDays(from) };
  }
  if (status === "SENT_TO_MANAGER" || status === "WAITING_MANAGER_REVIEW") {
    return { key: "MANAGER_REVIEW", label: text(lang, "Pregled menadžera", "Manager review"), owner: "MANAGER", nextAction: text(lang, "Menadžer popunjava review i predlaže sledeći korak.", "Manager fills review and proposes the next step."), tone: "progress", waitingDays: getWaitingDays(from) };
  }
  if (status === "INTERVIEW_SCHEDULED" || status === "SECOND_ROUND_COMPLETED") {
    return { key: "INTERVIEW", label: text(lang, "Intervju", "Interview"), owner: "MANAGER", nextAction: text(lang, "Unesi strukturisan feedback posle razgovora.", "Submit structured feedback after the interview."), tone: "progress", waitingDays: getWaitingDays(from) };
  }
  if (status === "WAITING_FINAL_APPROVAL") {
    return { key: "FINAL_DECISION", label: text(lang, "Finalna odluka", "Final decision"), owner: "FINAL_APPROVER", nextAction: text(lang, "Final approver donosi odluku na osnovu summary-ja.", "Final approver decides from the summary packet."), tone: "review", waitingDays: getWaitingDays(from) };
  }
  if (status === "APPROVED_FOR_EMPLOYMENT") {
    return { key: "APPROVED", label: text(lang, "Odobren / hired", "Approved / hired"), owner: "HR", nextAction: text(lang, "Proveri onboarding handoff.", "Verify onboarding handoff."), tone: "approved", waitingDays: 0 };
  }
  if (status === "ARCHIVED") {
    return { key: "ARCHIVED", label: text(lang, "Talent pool", "Talent pool"), owner: "NONE", nextAction: text(lang, "Može se ponovo aktivirati u novom procesu.", "Can be reused in a future process."), tone: "muted", waitingDays: 0 };
  }
  if (["REJECTED_BY_HR", "REJECTED_BY_MANAGER", "REJECTED_FINAL", "CANCELED"].includes(status)) {
    return { key: "REJECTED", label: text(lang, "Odbijen", "Rejected"), owner: "NONE", nextAction: text(lang, "Nema aktivnog sledećeg koraka.", "No active next step."), tone: "rejected", waitingDays: 0 };
  }
  return { key: "NEW", label: text(lang, "Novi kandidat", "New candidate"), owner: "HR", nextAction: text(lang, "Pregledaj kandidata.", "Review candidate."), tone: "pending", waitingDays: getWaitingDays(from) };
}
