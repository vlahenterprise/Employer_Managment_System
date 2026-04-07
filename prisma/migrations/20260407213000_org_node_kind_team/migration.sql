-- Add org chart node type and optional Team link so managers can have teams under them.
CREATE TYPE "OrgNodeKind" AS ENUM ('POSITION', 'TEAM');

ALTER TABLE "OrgPosition"
  ADD COLUMN "kind" "OrgNodeKind" NOT NULL DEFAULT 'POSITION',
  ADD COLUMN "teamId" TEXT;

CREATE INDEX IF NOT EXISTS "OrgPosition_kind_idx" ON "OrgPosition"("kind");
CREATE INDEX IF NOT EXISTS "OrgPosition_teamId_idx" ON "OrgPosition"("teamId");

ALTER TABLE "OrgPosition"
  ADD CONSTRAINT "OrgPosition_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
