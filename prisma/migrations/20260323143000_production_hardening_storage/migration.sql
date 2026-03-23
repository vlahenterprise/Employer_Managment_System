ALTER TABLE "HrCandidate"
ADD COLUMN     "latestCvSizeBytes" INTEGER,
ADD COLUMN     "latestCvUploadedAt" TIMESTAMP(3);

UPDATE "HrCandidate"
SET
  "latestCvSizeBytes" = COALESCE("latestCvSizeBytes", octet_length("latestCvData")),
  "latestCvUploadedAt" = COALESCE("latestCvUploadedAt", "updatedAt")
WHERE "latestCvData" IS NOT NULL;

CREATE INDEX "HrCandidate_updatedAt_idx" ON "HrCandidate"("updatedAt");

ALTER TABLE "BackupSnapshot"
ADD COLUMN     "runKey" TEXT,
ADD COLUMN     "manifestJson" JSONB,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ALTER COLUMN  "zipData" DROP NOT NULL;

UPDATE "BackupSnapshot"
SET "completedAt" = COALESCE("completedAt", "createdAt")
WHERE "completedAt" IS NULL;

CREATE UNIQUE INDEX "BackupSnapshot_runKey_key" ON "BackupSnapshot"("runKey");
CREATE INDEX "BackupSnapshot_source_createdAt_idx" ON "BackupSnapshot"("source", "createdAt");
