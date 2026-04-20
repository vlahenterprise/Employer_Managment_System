import type { HrCandidateStatus, HrProcessStatus } from "@prisma/client";

export type HrStageKey =
  | "REQUEST_APPROVAL"
  | "READY_FOR_HR"
  | "MANAGER_REVIEW"
  | "ROUND_TWO"
  | "FINAL_DECISION"
  | "APPROVED_FOR_HIRE"
  | "PAUSED"
  | "CLOSED"
  | "CANCELED";

export type HrWaitingOnKey = "SUPERIOR" | "HR" | "MANAGER" | "FINAL_APPROVER" | "NONE";

export type HrNextActionKey =
  | "APPROVE_REQUEST"
  | "START_SCREENING"
  | "SCREEN_CANDIDATES"
  | "MANAGER_REVIEW"
  | "ROUND_TWO_FEEDBACK"
  | "FINAL_DECISION"
  | "START_ONBOARDING"
  | "WAITING_INPUT"
  | "PROCESS_COMPLETE"
  | "PROCESS_CANCELED";

type ProcessLike = {
  status: HrProcessStatus | string;
  candidates?: Array<{ status: HrCandidateStatus | string }>;
};

type CandidateLike = {
  status: HrCandidateStatus | string;
};

type StageSummary = {
  stageKey: HrStageKey;
  waitingOn: HrWaitingOnKey;
  nextAction: HrNextActionKey;
  tone: "muted" | "review" | "progress" | "approved" | "rejected";
};

export function getCandidateStageSummary(candidate: CandidateLike): StageSummary {
  const status = String(candidate.status || "").toUpperCase();

  if (status === "NEW_APPLICANT" || status === "HR_SCREENING") {
    return {
      stageKey: "READY_FOR_HR" as HrStageKey,
      waitingOn: "HR" as HrWaitingOnKey,
      nextAction: "SCREEN_CANDIDATES" as HrNextActionKey,
      tone: "review" as const
    };
  }

  if (status === "ON_HOLD") {
    return {
      stageKey: "PAUSED" as HrStageKey,
      waitingOn: "HR" as HrWaitingOnKey,
      nextAction: "WAITING_INPUT" as HrNextActionKey,
      tone: "muted" as const
    };
  }

  if (status === "SENT_TO_MANAGER" || status === "WAITING_MANAGER_REVIEW") {
    return {
      stageKey: "MANAGER_REVIEW" as HrStageKey,
      waitingOn: "MANAGER" as HrWaitingOnKey,
      nextAction: "MANAGER_REVIEW" as HrNextActionKey,
      tone: "progress" as const
    };
  }

  if (status === "INTERVIEW_SCHEDULED" || status === "SECOND_ROUND_COMPLETED") {
    return {
      stageKey: "ROUND_TWO" as HrStageKey,
      waitingOn: "MANAGER" as HrWaitingOnKey,
      nextAction: "ROUND_TWO_FEEDBACK" as HrNextActionKey,
      tone: "progress" as const
    };
  }

  if (status === "WAITING_FINAL_APPROVAL") {
    return {
      stageKey: "FINAL_DECISION" as HrStageKey,
      waitingOn: "FINAL_APPROVER" as HrWaitingOnKey,
      nextAction: "FINAL_DECISION" as HrNextActionKey,
      tone: "review" as const
    };
  }

  if (status === "APPROVED_FOR_EMPLOYMENT") {
    return {
      stageKey: "APPROVED_FOR_HIRE" as HrStageKey,
      waitingOn: "HR" as HrWaitingOnKey,
      nextAction: "START_ONBOARDING" as HrNextActionKey,
      tone: "approved" as const
    };
  }

  if (status === "ARCHIVED") {
    return {
      stageKey: "CLOSED" as HrStageKey,
      waitingOn: "NONE" as HrWaitingOnKey,
      nextAction: "PROCESS_COMPLETE" as HrNextActionKey,
      tone: "muted" as const
    };
  }

  if (
    status === "REJECTED_BY_HR" ||
    status === "REJECTED_BY_MANAGER" ||
    status === "REJECTED_FINAL" ||
    status === "CANCELED"
  ) {
    return {
      stageKey: "CLOSED" as HrStageKey,
      waitingOn: "NONE" as HrWaitingOnKey,
      nextAction: "PROCESS_COMPLETE" as HrNextActionKey,
      tone: "rejected" as const
    };
  }

  return {
    stageKey: "READY_FOR_HR" as HrStageKey,
    waitingOn: "HR" as HrWaitingOnKey,
    nextAction: "SCREEN_CANDIDATES" as HrNextActionKey,
    tone: "review" as const
  };
}

export function getProcessWorkflowSummary(process: ProcessLike): StageSummary {
  const status = String(process.status || "").toUpperCase();
  const activeCandidates = (process.candidates || []).filter((candidate) =>
    !["ARCHIVED", "REJECTED_BY_HR", "REJECTED_BY_MANAGER", "REJECTED_FINAL", "CANCELED"].includes(
      String(candidate.status || "").toUpperCase()
    )
  );

  if (status === "CANCELED") {
    return {
      stageKey: "CANCELED" as HrStageKey,
      waitingOn: "NONE" as HrWaitingOnKey,
      nextAction: "PROCESS_CANCELED" as HrNextActionKey,
      tone: "rejected" as const
    };
  }

  if (status === "CLOSED") {
    return {
      stageKey: "CLOSED" as HrStageKey,
      waitingOn: "NONE" as HrWaitingOnKey,
      nextAction: "PROCESS_COMPLETE" as HrNextActionKey,
      tone: "approved" as const
    };
  }

  if (status === "ON_HOLD") {
    return {
      stageKey: "PAUSED" as HrStageKey,
      waitingOn: "HR" as HrWaitingOnKey,
      nextAction: "WAITING_INPUT" as HrNextActionKey,
      tone: "muted" as const
    };
  }

  if (status === "DRAFT") {
    return {
      stageKey: "REQUEST_APPROVAL" as HrStageKey,
      waitingOn: "SUPERIOR" as HrWaitingOnKey,
      nextAction: "APPROVE_REQUEST" as HrNextActionKey,
      tone: "review" as const
    };
  }

  const candidateStatuses = activeCandidates.map((candidate) => String(candidate.status || "").toUpperCase());

  if (candidateStatuses.some((candidateStatus) => candidateStatus === "WAITING_FINAL_APPROVAL")) {
    return {
      stageKey: "FINAL_DECISION" as HrStageKey,
      waitingOn: "FINAL_APPROVER" as HrWaitingOnKey,
      nextAction: "FINAL_DECISION" as HrNextActionKey,
      tone: "review" as const
    };
  }

  if (candidateStatuses.some((candidateStatus) => candidateStatus === "INTERVIEW_SCHEDULED" || candidateStatus === "SECOND_ROUND_COMPLETED")) {
    return {
      stageKey: "ROUND_TWO" as HrStageKey,
      waitingOn: "MANAGER" as HrWaitingOnKey,
      nextAction: "ROUND_TWO_FEEDBACK" as HrNextActionKey,
      tone: "progress" as const
    };
  }

  if (candidateStatuses.some((candidateStatus) => candidateStatus === "SENT_TO_MANAGER" || candidateStatus === "WAITING_MANAGER_REVIEW")) {
    return {
      stageKey: "MANAGER_REVIEW" as HrStageKey,
      waitingOn: "MANAGER" as HrWaitingOnKey,
      nextAction: "MANAGER_REVIEW" as HrNextActionKey,
      tone: "progress" as const
    };
  }

  if (candidateStatuses.some((candidateStatus) => candidateStatus === "APPROVED_FOR_EMPLOYMENT")) {
    return {
      stageKey: "APPROVED_FOR_HIRE" as HrStageKey,
      waitingOn: "HR" as HrWaitingOnKey,
      nextAction: "START_ONBOARDING" as HrNextActionKey,
      tone: "approved" as const
    };
  }

  if (candidateStatuses.some((candidateStatus) => candidateStatus === "NEW_APPLICANT" || candidateStatus === "HR_SCREENING")) {
    return {
      stageKey: "READY_FOR_HR" as HrStageKey,
      waitingOn: "HR" as HrWaitingOnKey,
      nextAction: "SCREEN_CANDIDATES" as HrNextActionKey,
      tone: "review" as const
    };
  }

  if (status === "APPROVED") {
    return {
      stageKey: "APPROVED_FOR_HIRE" as HrStageKey,
      waitingOn: "HR" as HrWaitingOnKey,
      nextAction: "START_ONBOARDING" as HrNextActionKey,
      tone: "approved" as const
    };
  }

  return {
    stageKey: "READY_FOR_HR" as HrStageKey,
    waitingOn: "HR" as HrWaitingOnKey,
    nextAction: status === "OPEN" ? "START_SCREENING" : "SCREEN_CANDIDATES",
    tone: "review" as const
  };
}

export function buildHrDashboardBuckets(processes: ProcessLike[]) {
  const buckets = {
    readyForHr: 0,
    hrScreening: 0,
    managerReview: 0,
    finalDecision: 0,
    approvedForHire: 0
  };

  for (const process of processes) {
    const status = String(process.status || "").toUpperCase();
    if (status === "OPEN" && (!process.candidates || process.candidates.length === 0)) {
      buckets.readyForHr += 1;
    }

    for (const candidate of process.candidates || []) {
      const candidateStatus = String(candidate.status || "").toUpperCase();
      if (candidateStatus === "NEW_APPLICANT" || candidateStatus === "HR_SCREENING" || candidateStatus === "ON_HOLD") buckets.hrScreening += 1;
      if (candidateStatus === "SENT_TO_MANAGER" || candidateStatus === "WAITING_MANAGER_REVIEW" || candidateStatus === "INTERVIEW_SCHEDULED") {
        buckets.managerReview += 1;
      }
      if (candidateStatus === "WAITING_FINAL_APPROVAL") buckets.finalDecision += 1;
      if (candidateStatus === "APPROVED_FOR_EMPLOYMENT") buckets.approvedForHire += 1;
    }
  }

  return buckets;
}
