# Employer Management System — Claude Context

## Šta je ovaj projekat
Interni sistem za upravljanje zaposlenima za kompaniju Vlah Enterprise.
Trenutno u produkciji na Vercel-u. Zaposleni mogu pratiti odsustva, zadatke, dnevne izveštaje,
performanse, kompanijski kalendar, profil i org strukturu.

## Stack
- **Framework:** Next.js 14 (App Router, Server Components + Client Components)
- **Baza:** PostgreSQL (Neon) + Prisma ORM
- **Auth:** NextAuth v4 — email/lozinka (bcrypt) + Google Workspace SSO
- **Rate limiting:** Upstash Redis (distributed) + in-memory fallback
- **Google Workspace:** Calendar sync, Gmail notifikacije, OAuth bot account
- **Deploy:** Vercel sa cron job-ovima

## Moduli (sve osim HR je AKTIVNO)

| Modul | Ruta | Status |
|---|---|---|
| Dashboard | /dashboard | ✅ Aktivan |
| Org struktura | /organization | ✅ Aktivan |
| Kompanijski kalendar | /company-calendar | ✅ Aktivan |
| Tim (manager) | /team | ✅ Aktivan |
| Zadaci | /tasks | ✅ Aktivan |
| Odsustva | /absence | ✅ Aktivan |
| Dnevni izveštaji | /reports | ✅ Aktivan |
| Performance | /performance | ✅ Aktivan |
| Profil | /profile | ✅ Aktivan |
| Inbox | /inbox | ✅ Aktivan |
| Admin panel | /admin/* | ✅ Aktivan |
| Audit Log | /admin/audit-log | ✅ Aktivan |
| Forgot/Reset lozinka | /forgot-password, /reset-password | ✅ Aktivan |
| HR modul | /hr, /candidates, /onboarding, /talent-pool | ❌ ONEMOGUĆEN (ENABLE_HR_MODULE=false) |

## Struktura projekta
```
src/
  app/                    # Next.js App Router stranice
    company-calendar/     # Kompanijski kalendar (CRUD, učesnici, pozicije)
    forgot-password/      # Forgot password stranica
    reset-password/       # Reset password stranica (token-based)
    profile/              # Profil (ChangePasswordForm, Drive linkovi edit)
    admin/audit-log/      # Audit log (TaskEvent + AbsenceEvent)
    api/reports/export-csv/  # CSV export dnevnih izveštaja
  server/
    company-calendar.ts   # Company Calendar business logic
    password-reset.ts     # Password reset + changeOwnPassword
    crypto.ts             # AES-256-GCM enkripcija polja (opt-in)
    google-workspace.ts   # Google Calendar + Gmail integracija
    backup.ts             # DB backup (hourly cron)
  components/
    AdminShell.tsx        # Admin panel layout sa tabovima (uključujući Audit Log)
prisma/
  schema.prisma           # DB schema (User, Task, Absence, CompanyEvent, PasswordResetToken, ...)
  migrations/             # Sve migracije
```

## Bezbednost (implementirano)
- Bcrypt (12 rounds) za lozinke
- Password policy: min 8 znakova, 1 uppercase, 1 broj
- Rate limiting na login: 10 pokušaja / 10 min po emailu (Upstash)
- Rate limiting na PDF/backup rutama
- CSRF zaštita (NextAuth)
- Security headers: HSTS, X-Frame-Options, CSP, Permissions-Policy
- `crypto.ts` — AES-256-GCM enkripcija polja (zahteva FIELD_ENCRYPTION_KEY env)
- Password reset: SHA-256 hashed token, TTL 1h, max 3 req / 15 min

## Google Workspace integracija
- Calendar sync za odsustva i task due dates
- Gmail notifikacije: kreiranje taskova, odluke o odsustvima, due date podsetnici
- Notifikacije za promene naloga (role, status, reset lozinke)
- Retry sa exponential backoff (500ms / 1s / 2s) za Google API pozive
- Runtime enable/disable po feature-u (settings u admin panelu)
- Konfigurisati: GOOGLE_WORKSPACE_* env varijable

## Pokretanje lokalno
```bash
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed   # kreira admin korisnika
npm run dev       # http://localhost:3000
```

## Env varijable (videti .env.example)
Ključne:
- `DATABASE_URL`, `DIRECT_URL` — Neon PostgreSQL
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `CRON_SECRET` — obavezno u produkciji (za backup i GW cron)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — distributed rate limiting
- `GOOGLE_WORKSPACE_*` — Calendar + Gmail integracija
- `FIELD_ENCRYPTION_KEY` — 64-char hex, za enkripciju osetljivih polja (opciono)
- `LOGIN_RATE_LIMIT_PER_10_MIN` — default 10

## Konvencije
- Sav UI tekst je na srpskom (i18n katalog za sr/en)
- TypeScript strict mode — bez `any` osim gde je NextAuth zahteva
- Prisma za sve DB operacije — ne pisati raw SQL
- Server Actions za sve mutacije (ne REST API osim gde je nužno: PDF, backup, CSV)
- `requireActiveUser()` ili `requireAdminUser()` na vrhu svake page/action
- `logInfo` / `logWarn` za sve bitne server evente
- `withAction()` helper za standardizovano error handling u admin actions
