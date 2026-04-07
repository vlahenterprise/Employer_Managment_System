-- Google Workspace integration state.
-- Keeps Google event/message identifiers in Postgres while secrets stay in environment variables.

CREATE TABLE IF NOT EXISTS "ExternalCalendarEvent" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "calendarId" TEXT NOT NULL,
  "googleEventId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalCalendarEvent_entityType_entityId_calendarId_key"
  ON "ExternalCalendarEvent"("entityType", "entityId", "calendarId");
CREATE INDEX IF NOT EXISTS "ExternalCalendarEvent_entityType_entityId_idx"
  ON "ExternalCalendarEvent"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "ExternalCalendarEvent_calendarId_idx"
  ON "ExternalCalendarEvent"("calendarId");
CREATE INDEX IF NOT EXISTS "ExternalCalendarEvent_status_lastSyncedAt_idx"
  ON "ExternalCalendarEvent"("status", "lastSyncedAt");

CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'GOOGLE_WORKSPACE',
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "dedupeKey" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDelivery_dedupeKey_key"
  ON "NotificationDelivery"("dedupeKey");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_scheduledAt_idx"
  ON "NotificationDelivery"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_entityType_entityId_idx"
  ON "NotificationDelivery"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_recipientEmail_createdAt_idx"
  ON "NotificationDelivery"("recipientEmail", "createdAt");
