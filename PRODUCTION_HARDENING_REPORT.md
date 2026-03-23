# Production Hardening Report

## Scope
A production-hardening pass for the Employer Management System focused on stability, deployment safety, database scalability, safer file/export handling, and operational readiness for Vercel + Neon. Existing routes, business logic, workflows, permissions, and user-facing behavior were preserved.

## Issues Found
- Runtime DB configuration was not clearly separated between pooled runtime traffic and direct migration traffic.
- Expensive export and backup routes lacked lightweight request throttling and request-level tracing.
- Backup architecture still treated the database as backup file storage, which is unsafe and wasteful for production.
- Candidate CV handling still supported direct binary storage in the database, with no metadata-first strategy when Drive links exist.
- PDF export routes were vulnerable to serverless cold-start and timeout instability.
- Cron backup execution needed stronger idempotency semantics for Vercel-style scheduling.
- Environment requirements and production rollout steps were under-documented.
- CI was missing a practical production-safety gate.
- Dependency audit surfaced security advisories in `next` and a transitive `basic-ftp` package.

## What Changed

### 1. Database and environment hardening
- Standardized config loading for pooled runtime DB access vs direct migration access.
- Kept Prisma singleton usage stable for serverless execution.
- Added explicit environment parsing for backup, file, and PDF runtime settings.
- Updated `.env.example` with production-safe Neon guidance and operational env vars.

### 2. Backup architecture hardening
- Reworked backup snapshots to store metadata/state in Postgres rather than ZIP archives as the default path.
- Added on-demand ZIP generation for downloads, while keeping legacy `zipData` compatibility.
- Added idempotent cron execution with a unique `runKey`.
- Added failure/completion metadata and manifest JSON to support safe operations and admin visibility.

### 3. File storage hardening
- Candidate CV uploads now prefer Drive-link workflows and store metadata when possible.
- Added CV size/upload timestamps.
- Candidate CV download now redirects to Drive when a Drive URL is available and only falls back to legacy DB bytes when needed.

### 4. PDF and heavy route hardening
- Locked expensive export routes to the Node.js runtime and added explicit duration limits.
- Hardened Chromium startup for Vercel with cached executable resolution and configurable timeout/path settings.
- Added request IDs and structured logging around PDF generation.
- Added lightweight route-level throttling for PDF and backup download/generation endpoints.

### 5. Observability and security hardening
- Added request metadata helpers (request ID and client IP extraction).
- Strengthened structured logging with redaction of secrets, cookies, tokens, and binary payloads.
- Improved protected cron handling through a dedicated secret and clearer logging.

### 6. CI and operational safety
- Added a practical GitHub Actions workflow for install, env validation, Prisma validation, lint, typecheck, tests, and build.
- Added scripts for env validation and Prisma migrate deploy usage.
- Improved load-test auth handling so protected API routes can be exercised with a valid session.

### 7. Dependency hardening
- Upgraded `next` and `eslint-config-next` from `14.2.3` to `14.2.35`.
- Added an override for `basic-ftp` to resolve the critical transitive advisory.

## Why It Matters
- Reduces the risk of Neon connection storms and misconfigured serverless runtime behavior.
- Prevents the database from being used as backup blob storage by default.
- Makes exports and backups safer under Vercel limits.
- Preserves access control while improving operational visibility.
- Gives the team a repeatable production validation path before releases.
- Reduces dependency security exposure without changing product behavior.

## Files Changed
- `.env.example`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/migrations/20260323143000_production_hardening_storage/migration.sql`
- `src/app/admin/backup/page.tsx`
- `src/app/api/absence/export-pdf/route.ts`
- `src/app/api/admin/backup/download/route.ts`
- `src/app/api/admin/backup/file/route.ts`
- `src/app/api/hr/candidate-cv/[candidateId]/route.ts`
- `src/app/api/internal/backup-cron/route.ts`
- `src/app/api/performance/eval-pdf/route.ts`
- `src/app/api/reports/dashboard-pdf/route.ts`
- `src/app/api/tasks/dashboard-pdf/route.ts`
- `src/app/candidates/[candidateId]/page.tsx`
- `src/app/hr/actions.ts`
- `src/server/backup-scheduler.ts`
- `src/server/backup.ts`
- `src/server/config.ts`
- `src/server/db.ts`
- `src/server/hr.ts`
- `src/server/log.ts`
- `src/server/pdf.ts`
- `src/server/request-meta.ts`
- `src/server/route-rate-limit.ts`
- `scripts/check-env.ts`
- `scripts/load-test.ts`
- `.github/workflows/ci.yml`
- `test/route-rate-limit.test.ts`

## Validation Performed
- `npm install`
- `npm run env:check`
- `npm run db:generate`
- `npm run db:validate`
- `npm run lint`
- `npm run typecheck:strict`
- `npm test`
- `npm run build`
- Smoke checks across key authenticated and unauthenticated routes
- Load checks for public health, DB-aware health, dashboard, and protected API routing with authenticated sessions
- Route-limit behavior was also confirmed separately on backup download before running success-path checks with limits temporarily disabled in local dev

## Rollout Notes
1. Ensure `DATABASE_URL` uses the Neon pooled/serverless connection string.
2. Ensure `DIRECT_URL` uses the direct Neon connection string for Prisma CLI.
3. Set or rotate `CRON_SECRET` in the deployment environment.
4. Run `npm run db:migrate:deploy` during production rollout.
5. Redeploy after env changes so runtime route settings and config are active.
6. Verify `/api/health?db=1`, one PDF export, one candidate CV download, and one admin backup download after deploy.

## Rollback Considerations
- Application code can be rolled back by redeploying the previous Git commit.
- The migration is backward-compatible for runtime reads because new columns are additive and legacy `zipData` / CV byte fallbacks remain supported.
- If rollback is required, keep the new DB columns in place; older code should continue to function as long as the original schema fields remain untouched.
- If backup generation causes operational pressure, set route limits lower or temporarily disable cron execution by clearing or rotating `CRON_SECRET` and disabling the scheduled trigger.

## Remaining Risks / Follow-up
- `next@14.2.35` still has audit notices that are only fully resolved in a major-version upgrade; because the app does not use `next/image`, the practical exposure is reduced, but a future planned upgrade to a supported Next major should remain on the roadmap.
- Legacy CV binary data is still supported for backward compatibility; long term, migrating fully to Drive/object storage metadata only would be cleaner.
- Backup ZIP generation is now on-demand and safer, but very large future datasets may still benefit from external object storage and async archive generation.
- Several large server/domain files remain candidates for future refactoring once product changes settle.
