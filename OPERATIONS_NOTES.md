# Operations Notes

## What is safe to change
- UI copy, labels, and documentation
- Dashboard composition that does not alter permissions or business rules
- Tooltip/help text
- Non-breaking CSS/layout polish
- Read-only reporting queries when data shape and permissions stay the same
- Optional env defaults in `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/.env.example`
- Monitoring/logging improvements that keep secret redaction intact

## What is dangerous to change
- `DATABASE_URL` / `DIRECT_URL` wiring
- Prisma datasource config and client creation
- Auth/session config in `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/src/server/auth.ts`
- Route protection in middleware and server-side permission checks
- Backup cron auth/idempotency logic
- PDF runtime configuration and Chromium launch behavior
- Candidate CV download behavior and legacy fallback handling
- Performance scoring logic and evaluation workflow
- HR workflow state transitions and approval ownership

## Most fragile / highest-attention areas
- PDF export routes
- Backup generation and cron execution
- Legacy file fallback paths (`latestCvData`, `zipData`)
- Large server domain files (`hr`, `performance`, `backup`)
- Any route doing DB aggregation plus HTML/PDF rendering in one request
- Any code that adds new heavy routes without rate limiting or Node runtime pinning

## Current production file strategy
- Preferred production path:
  - Google Drive links / metadata
- Legacy fallback path:
  - database bytes for old candidate CVs
  - legacy backup blob support for older snapshots

Do not expand database binary storage again unless there is a very strong reason.

## What to test before every future deploy
1. `npm run env:check`
2. `npm run db:generate`
3. `npm run db:validate`
4. `npm run lint`
5. `npm run typecheck:strict`
6. `npm test`
7. `npm run build`
8. One authenticated smoke check for:
   - `/dashboard`
   - `/tasks`
   - `/reports/manager`
   - `/absence`
   - `/performance`
   - `/hr`
   - `/onboarding`
   - `/organization`
   - `/admin/users`
9. One export smoke check for:
   - reports PDF
   - tasks PDF
   - absence PDF
   - performance PDF
10. One backup smoke check:
   - backup download
   - backup file download
11. One file-access smoke check:
   - Drive-backed CV
   - legacy fallback CV if available

## Safe deployment habits
- Run migrations with `npm run db:migrate:deploy` before or during the production rollout window
- Never run Prisma dev migrations against production
- Keep `CRON_SECRET` set before enabling production cron
- Prefer additive schema changes and compatibility layers
- For heavy-route changes, always verify:
  - `runtime = "nodejs"`
  - timeout expectations
  - request logging
  - route throttling if the route is expensive

## Vercel / Neon notes
- Runtime app traffic must use the pooled Neon URL
- Prisma migrations and CLI must use the direct Neon URL
- Avoid increasing runtime connection limits casually
- Watch PDF and backup durations after every release

## CI / repository note
- CI workflow is currently stored as a template at:
  - `/Users/milosdimitrijevic/Documents/05.Coding/01.Employer Managment System/docs/ops/github-actions-ci.yml.example`
- Activating real GitHub Actions requires credentials with `workflow` scope

## When to pause and review before changing code
- Anything touching auth/session behavior
- Anything touching manager/HR/admin permission checks
- Anything touching performance scoring
- Anything touching backup or PDF route behavior
- Anything replacing Drive-link flows with DB file storage
