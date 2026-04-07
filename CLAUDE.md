# Employer Management System — Claude Context

## Šta je ovaj projekat
Interni sistem za upravljanje zaposlenima za kompaniju Vlah Enterprise.
Trenutno u produkciji na Vercel-u.

## Stack
- **Framework:** Next.js 14 (App Router)
- **Baza:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth v4 (email/password + Google Workspace SSO)
- **Rate limiting:** Upstash Redis
- **Deploy:** Vercel
- **Jezik UI:** Srpski

## Struktura projekta
```
src/
  app/          # Next.js App Router stranice i API rute
  components/   # React komponente
  lib/          # Utility funkcije
  server/       # Server-side logika, config
  types/        # TypeScript tipovi
  i18n/         # Internationalizacija
prisma/
  schema.prisma # DB schema
  migrations/   # Migracije
scripts/        # Utility skripte (import, seed, check)
```

## Pokretanje lokalno
```bash
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed   # kreira admin korisnika
npm run dev       # http://localhost:3000
```

## Env varijable (videti .env.example)
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — random string
- `NEXTAUTH_URL` — app URL
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google SSO (opciono)
- `AUTH_ALLOWED_EMAIL_DOMAINS` — dozvoljeni email domeni
- `AUTH_AUTO_PROVISION` — auto-kreiranje korisnika na prvom Google login-u

## Važne napomene
- `.env` fajl NIKADA ne ide u git
- HR i hiring moduli su trenutno **privremeno onemogućeni** (videti commit istoriju)
- Admin panel je na `/admin/*`
- Google Workspace migracija je u toku (branch/migrations za to postoje)

## Konvencije
- Sav UI tekst je na srpskom
- TypeScript strict mode
- Prisma za sve DB operacije — ne pisati raw SQL osim ako nema alternative
- API rute su u `src/app/api/`
