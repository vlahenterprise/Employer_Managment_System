-- Add company calendar events with read access for all active users and edit access via add-on/admin.
CREATE TYPE "CompanyEventStatus" AS ENUM ('ACTIVE', 'CANCELLED');

ALTER TABLE "User" ADD COLUMN "companyCalendarAddon" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CompanyEvent" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "status" "CompanyEventStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyEventParticipant" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyEventParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyEventPosition" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyEventPosition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_companyCalendarAddon_idx" ON "User"("companyCalendarAddon");
CREATE INDEX "CompanyEvent_status_startsAt_endsAt_idx" ON "CompanyEvent"("status", "startsAt", "endsAt");
CREATE INDEX "CompanyEvent_createdById_idx" ON "CompanyEvent"("createdById");
CREATE UNIQUE INDEX "CompanyEventParticipant_eventId_userId_key" ON "CompanyEventParticipant"("eventId", "userId");
CREATE INDEX "CompanyEventParticipant_userId_idx" ON "CompanyEventParticipant"("userId");
CREATE UNIQUE INDEX "CompanyEventPosition_eventId_positionId_key" ON "CompanyEventPosition"("eventId", "positionId");
CREATE INDEX "CompanyEventPosition_positionId_idx" ON "CompanyEventPosition"("positionId");

ALTER TABLE "CompanyEvent" ADD CONSTRAINT "CompanyEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyEventParticipant" ADD CONSTRAINT "CompanyEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CompanyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyEventParticipant" ADD CONSTRAINT "CompanyEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyEventPosition" ADD CONSTRAINT "CompanyEventPosition_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CompanyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyEventPosition" ADD CONSTRAINT "CompanyEventPosition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OrgPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
