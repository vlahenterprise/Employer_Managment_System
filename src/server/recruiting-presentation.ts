import type { HrCandidateStatus, OnboardingItemOwner, OnboardingStatus } from "@prisma/client";

type Lang = "sr" | "en";

type Tone = "approved" | "pending" | "review" | "progress" | "rejected" | "muted";

const ACTIVE_CANDIDATE_STATUSES = new Set([
  "NEW_APPLICANT",
  "HR_SCREENING",
  "SENT_TO_MANAGER",
  "WAITING_MANAGER_REVIEW",
  "INTERVIEW_SCHEDULED",
  "SECOND_ROUND_COMPLETED",
  "WAITING_FINAL_APPROVAL",
  "APPROVED_FOR_EMPLOYMENT"
]);

const TALENT_POOL_CANDIDATE_STATUSES = new Set(["ARCHIVED", "CANCELED", "REJECTED_FINAL", "REJECTED_BY_MANAGER", "REJECTED_BY_HR"]);

export function isActiveCandidateStatus(status: HrCandidateStatus | string | null | undefined) {
  return ACTIVE_CANDIDATE_STATUSES.has(String(status || "").toUpperCase());
}

export function isTalentPoolCandidateStatus(status: HrCandidateStatus | string | null | undefined) {
  return TALENT_POOL_CANDIDATE_STATUSES.has(String(status || "").toUpperCase());
}

export function getCandidateStageOptions(lang: Lang) {
  const options = [
    "NEW_APPLICANT",
    "HR_SCREENING",
    "SENT_TO_MANAGER",
    "WAITING_MANAGER_REVIEW",
    "INTERVIEW_SCHEDULED",
    "SECOND_ROUND_COMPLETED",
    "WAITING_FINAL_APPROVAL",
    "APPROVED_FOR_EMPLOYMENT",
    "ARCHIVED",
    "CANCELED"
  ] as const;

  return [
    {
      value: "ALL",
      label: lang === "sr" ? "Sve faze" : "All stages"
    },
    ...options.map((value) => ({
      value,
      label: getCandidateStageMeta(value, lang).label
    }))
  ];
}

export function getCandidateStageMeta(status: HrCandidateStatus | string | null | undefined, lang: Lang): {
  label: string;
  tone: Tone;
} {
  const value = String(status || "").toUpperCase();

  switch (value) {
    case "NEW_APPLICANT":
      return { label: lang === "sr" ? "Novi kandidat" : "New applicant", tone: "pending" };
    case "HR_SCREENING":
      return { label: lang === "sr" ? "HR screening" : "HR screening", tone: "review" };
    case "REJECTED_BY_HR":
      return { label: lang === "sr" ? "Odbijen od HR" : "Rejected by HR", tone: "rejected" };
    case "SENT_TO_MANAGER":
      return { label: lang === "sr" ? "Poslat menadžeru" : "Sent to manager", tone: "progress" };
    case "WAITING_MANAGER_REVIEW":
      return { label: lang === "sr" ? "Čeka pregled menadžera" : "Waiting manager review", tone: "review" };
    case "INTERVIEW_SCHEDULED":
      return { label: lang === "sr" ? "Zakazan 2. krug" : "Round 2 scheduled", tone: "progress" };
    case "SECOND_ROUND_COMPLETED":
      return { label: lang === "sr" ? "2. krug završen" : "Round 2 completed", tone: "progress" };
    case "REJECTED_BY_MANAGER":
      return { label: lang === "sr" ? "Odbijen posle kruga" : "Rejected after round", tone: "rejected" };
    case "WAITING_FINAL_APPROVAL":
      return { label: lang === "sr" ? "Čeka finalno odobrenje" : "Waiting final approval", tone: "review" };
    case "APPROVED_FOR_EMPLOYMENT":
      return { label: lang === "sr" ? "Odobren za zaposlenje" : "Approved for hire", tone: "approved" };
    case "REJECTED_FINAL":
      return { label: lang === "sr" ? "Finalno odbijen" : "Rejected final", tone: "rejected" };
    case "ARCHIVED":
      return { label: lang === "sr" ? "Talent pool" : "Talent pool", tone: "muted" };
    case "CANCELED":
      return { label: lang === "sr" ? "Otkazano" : "Canceled", tone: "muted" };
    default:
      return { label: lang === "sr" ? "Bez faze" : "No stage", tone: "muted" };
  }
}

export function getOnboardingStatusMeta(status: OnboardingStatus | string | null | undefined, lang: Lang): {
  label: string;
  tone: Tone;
  nextOwnerLabel: string;
} {
  const value = String(status || "").toUpperCase();

  switch (value) {
    case "PLANNED":
      return {
        label: lang === "sr" ? "Planirano" : "Planned",
        tone: "pending",
        nextOwnerLabel: lang === "sr" ? "HR i menadžer pripremaju start" : "HR and manager prepare the start"
      };
    case "ACTIVE":
      return {
        label: lang === "sr" ? "Aktivno" : "Active",
        tone: "progress",
        nextOwnerLabel: lang === "sr" ? "Proces je u toku" : "The onboarding process is in progress"
      };
    case "WAITING_EMPLOYEE_ACTIONS":
      return {
        label: lang === "sr" ? "Čeka zaposlenog" : "Waiting employee actions",
        tone: "review",
        nextOwnerLabel: lang === "sr" ? "Zaposleni treba da završi sledeće korake" : "Employee needs to complete the next steps"
      };
    case "WAITING_MANAGER_ACTIONS":
      return {
        label: lang === "sr" ? "Čeka menadžera" : "Waiting manager actions",
        tone: "review",
        nextOwnerLabel: lang === "sr" ? "Menadžer treba da reaguje" : "Manager needs to act next"
      };
    case "WAITING_HR_ACTIONS":
      return {
        label: lang === "sr" ? "Čeka HR" : "Waiting HR actions",
        tone: "review",
        nextOwnerLabel: lang === "sr" ? "HR treba da završi sledeće korake" : "HR needs to complete the next steps"
      };
    case "COMPLETED":
      return {
        label: lang === "sr" ? "Završeno" : "Completed",
        tone: "approved",
        nextOwnerLabel: lang === "sr" ? "Onboarding je uspešno završen" : "Onboarding is successfully completed"
      };
    default:
      return {
        label: lang === "sr" ? "Nepoznato" : "Unknown",
        tone: "muted",
        nextOwnerLabel: lang === "sr" ? "Nema aktivnog sledećeg koraka" : "There is no active next step"
      };
  }
}

export function getOnboardingOwnerLabel(owner: OnboardingItemOwner | string | null | undefined, lang: Lang) {
  const value = String(owner || "").toUpperCase();
  if (value === "HR") return lang === "sr" ? "HR" : "HR";
  if (value === "MANAGER") return lang === "sr" ? "Menadžer" : "Manager";
  if (value === "EMPLOYEE") return lang === "sr" ? "Zaposleni" : "Employee";
  return lang === "sr" ? "Zajednički" : "Shared";
}
