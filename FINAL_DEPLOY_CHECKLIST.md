# Final Deploy Checklist

## Pre-deploy verification
- [ ] Confirm production uses the Neon **pooled** connection for `DATABASE_URL`.
- [ ] Confirm production uses the Neon **direct** connection for `DIRECT_URL`.
- [ ] Confirm `NEXTAUTH_SECRET` is set and matches the active production auth config.
- [ ] Confirm `NEXTAUTH_URL` points to the production domain.
- [ ] Confirm `CRON_SECRET` is set for the protected backup cron route.
- [ ] Confirm `CV_MAX_UPLOAD_BYTES`, `PDF_ROUTE_LIMIT_PER_MINUTE`, and `BACKUP_ROUTE_LIMIT_PER_MINUTE` are set to desired production values.
- [ ] Confirm any optional Chromium overrides are only set if intentionally needed:
  - `CHROMIUM_EXECUTABLE_PATH`
  - `CHROMIUM_PACK_URL`
  - `PDF_RENDER_TIMEOUT_MS`

## Exact production deployment order
1. Pull the latest `main` branch.
2. Review `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/PRODUCTION_HARDENING_REPORT.md`.
3. Run `npm install`.
4. Run `npm run env:check`.
5. Run `npm run db:generate`.
6. Run `npm run db:validate`.
7. Run `npm run lint`.
8. Run `npm run typecheck:strict`.
9. Run `npm test`.
10. Run `npm run build`.
11. Apply database migrations with `npm run db:migrate:deploy`.
12. Deploy the app to Vercel production.
13. Verify the production health endpoint: `/api/health?db=1`.
14. Verify one PDF export from each major export area:
    - reports
    - tasks
    - absence
    - performance
15. Verify one admin backup generation/download flow.
16. Verify one candidate CV access flow:
    - Drive-backed candidate
    - legacy binary-backed candidate if one still exists
17. Verify the protected backup cron route is not callable without the correct bearer token.

## Post-deploy smoke checklist
- [ ] Login works
- [ ] Dashboard loads
- [ ] Tasks load and approvals still work
- [ ] Reports manager dashboard loads
- [ ] Absence page and PDF export work
- [ ] Performance page and evaluation PDF work
- [ ] HR pages load and CV links/downloads work
- [ ] Onboarding pages load
- [ ] Organization page loads
- [ ] Admin backup list and download work

## What was specifically verified in this hardening pass
- Full validation suite passed locally:
  - `npm install`
  - `npm run env:check`
  - `npm run db:generate`
  - `npm run db:validate`
  - `npm run lint`
  - `npm run typecheck:strict`
  - `npm test`
  - `npm run build`
- Authenticated smoke routes passed:
  - `/dashboard`
  - `/tasks`
  - `/reports/manager`
  - `/absence`
  - `/performance`
  - `/hr`
  - `/onboarding`
  - `/organization`
  - `/admin/users`
- Load/sanity checks passed for:
  - `/api/health`
  - `/api/health?db=1`
  - `/dashboard`
  - `/api/admin/backup/download`
  - `/api/reports/dashboard-pdf`
  - `/api/tasks/dashboard-pdf`
  - `/api/absence/export-pdf`

## Still-risky areas to watch closely after release
- PDF export routes are stable, but they remain among the heaviest Vercel functions and should be monitored for duration spikes.
- Backup ZIP generation is now much safer, but very large future datasets may still benefit from external object storage.
- Legacy CV binary records are still supported for compatibility; long-term cleanup to metadata/Drive-only is recommended.
- `next@14.2.35` removed the critical audit issue set we had earlier, but a future major-version upgrade is still the right long-term security path.
- The CI workflow is prepared as a template at `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/docs/ops/github-actions-ci.yml.example`; activating it in GitHub still requires a token with `workflow` scope.

## Rollback order if needed
1. Revert/redeploy the previous production Vercel deployment.
2. Leave the additive Prisma migration in place unless a schema-specific rollback is absolutely required.
3. If backup route load becomes an issue, temporarily lower usage by reducing admin usage or tightening route limits.
4. If a production incident involves exports, disable the specific export path operationally before touching unrelated modules.
