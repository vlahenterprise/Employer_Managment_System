# Employer Management System

## Commands
- `npm run dev` — local development
- `npm run build` — Prisma generate + production build
- `npm run lint` — Next.js lint
- `npm run db:generate` — regenerate Prisma client
- `npm run db:migrate` — local Prisma migrate dev
- `npx prisma migrate deploy` — apply migrations in deployed environments

## Conventions
- Keep route/page layers thin; move DB, permission, workflow, and validation logic into `src/server/*`.
- Prefer small typed helpers over inline parsing in pages, route handlers, and server actions.
- Use Prisma `select`/`include` narrowly; avoid fetching whole records when only a few fields are needed.
- Preserve current routes, URL params, and current UI structure unless a fix requires a change.
- Target Vercel + Neon compatibility for any background work, exports, and file handling.

## Business Constraints
- Do not change workflow semantics for reports, tasks, absence, performance, HR, or management approval flows unless fixing a real bug.
- Server-side authorization must remain explicit for `ADMIN`, `HR`, `MANAGER`, `USER`, `hrAddon`, and manager-hierarchy rules.
- Keep settings-driven behavior intact; do not hardcode company-specific logic that should stay configurable.
- Maintain data compatibility with existing Prisma schema semantics and existing production data.

## Must Not Break
- NextAuth login/session flow and active-user checks
- Manager hierarchy approvals for tasks and absence
- Performance evaluation locking/closing rules and scoring math
- Existing PDF export endpoints and admin import flows
- Vercel production deployability and Neon database connectivity
