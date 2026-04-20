-- Add lightweight structured hiring fields without changing existing workflow semantics.
ALTER TYPE "HrCandidateStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';

ALTER TABLE "HrProcess"
  ADD COLUMN IF NOT EXISTS "positionId" TEXT,
  ADD COLUMN IF NOT EXISTS "isBudgeted" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "budgetRange" TEXT,
  ADD COLUMN IF NOT EXISTS "isInSystematization" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "draftJobDescriptionUrl" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'HrProcess_positionId_fkey'
      AND table_name = 'HrProcess'
  ) THEN
    ALTER TABLE "HrProcess"
      ADD CONSTRAINT "HrProcess_positionId_fkey"
      FOREIGN KEY ("positionId") REFERENCES "OrgPosition"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "HrCandidate"
  ADD COLUMN IF NOT EXISTS "seniority" TEXT,
  ADD COLUMN IF NOT EXISTS "language" TEXT,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" JSONB,
  ADD COLUMN IF NOT EXISTS "skillMarkers" JSONB;

ALTER TABLE "HrProcessCandidate"
  ADD COLUMN IF NOT EXISTS "sourceGroup" TEXT,
  ADD COLUMN IF NOT EXISTS "expectedSalary" TEXT,
  ADD COLUMN IF NOT EXISTS "hrScorecard" JSONB,
  ADD COLUMN IF NOT EXISTS "hrRecommendation" TEXT,
  ADD COLUMN IF NOT EXISTS "hrRejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "mustHaveChecklist" JSONB,
  ADD COLUMN IF NOT EXISTS "niceToHaveChecklist" JSONB,
  ADD COLUMN IF NOT EXISTS "managerScorecard" JSONB,
  ADD COLUMN IF NOT EXISTS "managerRecommendation" TEXT,
  ADD COLUMN IF NOT EXISTS "managerRejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "interviewFeedback" JSONB,
  ADD COLUMN IF NOT EXISTS "interviewRecommendation" TEXT,
  ADD COLUMN IF NOT EXISTS "interviewReadiness" TEXT,
  ADD COLUMN IF NOT EXISTS "finalReasonCode" TEXT,
  ADD COLUMN IF NOT EXISTS "plannedStartDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastDecision" TEXT,
  ADD COLUMN IF NOT EXISTS "lastDecisionAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "HrProcess_positionId_idx" ON "HrProcess"("positionId");
CREATE INDEX IF NOT EXISTS "HrCandidate_seniority_idx" ON "HrCandidate"("seniority");
CREATE INDEX IF NOT EXISTS "HrCandidate_language_idx" ON "HrCandidate"("language");
CREATE INDEX IF NOT EXISTS "HrCandidate_location_idx" ON "HrCandidate"("location");
CREATE INDEX IF NOT EXISTS "HrProcessCandidate_sourceGroup_idx" ON "HrProcessCandidate"("sourceGroup");
CREATE INDEX IF NOT EXISTS "HrProcessCandidate_hrRecommendation_idx" ON "HrProcessCandidate"("hrRecommendation");
CREATE INDEX IF NOT EXISTS "HrProcessCandidate_managerRecommendation_idx" ON "HrProcessCandidate"("managerRecommendation");
