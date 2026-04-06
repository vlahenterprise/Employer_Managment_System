# Live Production Readiness

## Purpose
This document is the final production handoff checklist for the Employer Management System running on Vercel + Neon. It captures the exact environment contract, deployment order, smoke checks, first-24h monitoring, and rollback steps.

## Final required Vercel environment variables

### Required in production
- `DATABASE_URL`
  - Must be the Neon **pooled/serverless** connection string.
  - Recommended query parameters:
    - `sslmode=require`
    - `pgbouncer=true`
    - `connection_limit=5`
    - `pool_timeout=15`
    - `connect_timeout=15`
- `DIRECT_URL`
  - Must be the Neon **direct** connection string.
  - Used for Prisma CLI and migrations only.
  - Recommended query parameters:
    - `sslmode=require`
    - `connect_timeout=15`
- `NEXTAUTH_SECRET`
  - Required for session signing and auth stability.
- `NEXTAUTH_URL`
  - Must match the production domain exactly.
  - Example: `https://employer.dashboard.vlahenterpriseapp.com`
- `CRON_SECRET`
  - Required because `/api/internal/backup-cron` is fail-closed in production.

### Required only if Google SSO is enabled
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Optional, but recommended to set explicitly in production
- `AUTH_ALLOWED_EMAIL_DOMAINS`
  - Comma-separated allowlist if email-domain restrictions are desired.
- `AUTH_AUTO_PROVISION`
  - `true` only if automatic Google SSO user provisioning is intentionally allowed.
- `CV_MAX_UPLOAD_BYTES`
  - Default if omitted: `5242880` (5 MB)
- `PDF_ROUTE_LIMIT_PER_MINUTE`
  - Default if omitted: `10`
- `BACKUP_ROUTE_LIMIT_PER_MINUTE`
  - Default if omitted: `4`
- `PDF_RENDER_TIMEOUT_MS`
  - Default if omitted: `12000`
- `CHROMIUM_EXECUTABLE_PATH`
  - Only set if production uses a fixed Chromium binary path.
- `CHROMIUM_PACK_URL`
  - Only set if overriding the default Sparticuz Chromium pack source.

### Not required for production runtime
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_NAME`
- `SEED_ADMIN_PASSWORD`
  - Only used for seeding.

### Local/dev/test-only variables
- `BASE_URL`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`
  - Used by local smoke/load scripts, not by Vercel production runtime.

## Required Neon settings
- Use the Neon **pooled** connection string for `DATABASE_URL`.
- Use the Neon **direct** connection string for `DIRECT_URL`.
- Keep SSL enabled.
- Keep runtime connection limits conservative to avoid serverless connection storms.
- Do not point runtime traffic at the direct connection string.
- Do not run Prisma migrations against the pooled connection string.
- Use the same production branch/database for Vercel runtime and Prisma deploys.

## Prisma / Neon confirmation
- Runtime app traffic uses `DATABASE_URL` through `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/server/db.ts`
- Prisma schema uses:
  - `url = env("DATABASE_URL")`
  - `directUrl = env("DIRECT_URL")`
  in `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/prisma/schema.prisma`
- Prisma singleton usage is preserved for safe reuse in serverless/dev.

## Heavy routes that must be monitored closely

### Highest priority
- `/api/reports/dashboard-pdf`
- `/api/tasks/dashboard-pdf`
- `/api/absence/export-pdf`
- `/api/performance/eval-pdf`
- `/api/admin/backup/download`
- `/api/admin/backup/file`
- `/api/internal/backup-cron`

### Why these matter
- They run on Node.js runtime.
- They do heavier DB reads, PDF rendering, archive generation, or cron-triggered work.
- They are the most likely to show duration spikes, memory pressure, or rate-limit complaints first.

## Cron job review

### Active cron jobs
- Vercel cron:
  - path: `/api/internal/backup-cron`
  - schedule: hourly (`0 * * * *`)

### Authentication
- In production, the route requires:
  - `Authorization: Bearer <CRON_SECRET>`
- If `CRON_SECRET` is missing:
  - production requests are rejected
  - non-production remains callable for local/dev testing only

### Idempotency
- Backup cron runs use a unique `runKey` shaped like `cron:YYYY-MM-DD`
- Duplicate executions for the same run window are handled safely
- Duplicate cron execution does not create corrupted double-state

### Failure behavior
- Failure returns a controlled JSON payload:
  - `ok: false`
  - `error: "BACKUP_FAILED"`
- Failures are logged with request ID
- No partial always-on in-memory scheduler remains active

## File handling review

### Current production path
- Candidate CVs should use `cvDriveUrl`
- Position/job/work instruction docs use Drive links
- Onboarding supporting documents use links/metadata rather than binary DB storage

### Legacy fallback still supported
- Candidate CV download falls back to legacy `latestCvData` bytes if `cvDriveUrl` is absent
- Backup download falls back to legacy `zipData` if an old snapshot still has it

### Production safety confirmation
- Current preferred production file path is metadata/link-first
- Legacy binary support remains only for backward compatibility
- Sensitive payloads are redacted from logs

## Backup architecture review

### Current safe design
- Postgres is the source of truth for backup metadata and run state
- ZIP archives are generated on demand for download
- Backup cron is authenticated and idempotent

### What was removed as the default architecture
- Database-backed storage of generated backup ZIP blobs as the normal operating path

### Residual note
- Legacy `zipData` support remains as a compatibility layer only

## Exact deploy order for production
1. Pull latest `main`
2. Confirm Vercel production env vars are present and correct
3. Confirm Neon pooled URL is set as `DATABASE_URL`
4. Confirm Neon direct URL is set as `DIRECT_URL`
5. Run:
   - `npm install`
   - `npm run env:check`
   - `npm run db:generate`
   - `npm run db:validate`
   - `npm run lint`
   - `npm run typecheck:strict`
   - `npm test`
   - `npm run build`
6. Run `npm run db:migrate:deploy`
7. Deploy to Vercel production
8. Verify `/api/health`
9. Verify `/api/health?db=1`
10. Verify one PDF export from:
    - reports
    - tasks
    - absence
    - performance
11. Verify one admin backup generation/download flow
12. Verify one candidate CV flow:
    - Drive-backed candidate
    - legacy binary-backed candidate if one still exists
13. Verify `/api/internal/backup-cron` rejects unauthorized requests

## Post-deploy smoke tests
- Login works
- Dashboard loads
- Tasks load and approvals still work
- Daily reports manager page loads
- Absence page loads and PDF export works
- Performance page loads and eval PDF works
- HR pages load and candidate CV access works
- Onboarding pages load
- Organization page loads
- Admin backup area loads, downloads, and lists snapshots correctly

## First 24h monitoring checklist
- Watch Vercel logs for:
  - `pdf.render.failed`
  - `backup.cron.failed`
  - `backup.download.failed`
  - `backup.file.failed`
  - `health.db.failed`
  - repeated auth failures on protected admin/HR routes
- Watch Vercel function durations for:
  - all PDF routes
  - backup download/file routes
  - backup cron route
- Watch Neon for:
  - connection spikes
  - query latency spikes
  - failed direct migration attempts
- Verify at least one scheduled cron run completes successfully
- Verify no users report broken PDF exports, backup downloads, or CV access

## Rollback checklist
1. Redeploy the previous known-good Vercel deployment
2. Leave additive Prisma schema changes in place unless a schema-specific incident requires otherwise
3. If the issue is export-related:
   - lower route usage operationally
   - inspect logs by request ID
   - verify Chromium/runtime envs
4. If the issue is backup-related:
   - verify `CRON_SECRET`
   - temporarily pause cron execution if necessary
   - keep metadata rows; do not manually delete snapshots during incident response unless you know the failure mode
5. If the issue is file-related:
   - verify Drive-backed candidates first
   - then verify whether the affected record is using legacy DB bytes fallback

## Still-risky areas
- PDF routes remain the heaviest runtime paths and should be watched most closely
- Route throttling is per-instance memory-based, so it is best-effort rather than globally distributed
- Legacy binary CV records and legacy backup blobs still exist as compatibility paths
- Backup ZIP generation is safe for current scale, but larger future datasets should move toward object storage
- CI workflow is still a template file until a GitHub token with `workflow` scope is used
