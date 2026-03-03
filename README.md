# Employer Management System

Stack: **Next.js + PostgreSQL + Prisma** (bez Google Sheets integracije).

## Lokalni setup

### 1) Prerequisites
- Node.js (preporuka: 20+)
- PostgreSQL (lokalno ili remote)

### 2) Env
1. Kopiraj `.env.example` u `.env`
2. Popuni:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET` (primer: `openssl rand -base64 32`)
   - `NEXTAUTH_URL` (u dev: `http://localhost:3000`)

### 3) Install
```bash
npm install
```

### 4) Prisma
```bash
npm run db:generate
npm run db:migrate -- --name init
```

### 5) Seed (admin za email+password)
U `.env` postavi:
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_NAME`
- `SEED_ADMIN_PASSWORD`

Zatim:
```bash
npm run db:seed
```

### 6) Start
```bash
npm run dev
```

App: `http://localhost:3000`

## Auth

### Email + password (privremeno)
- Radi samo za korisnike koji u bazi imaju `passwordHash` (seed to kreira).

### Google Workspace SSO (opciono)
1. U Google Cloud Console kreiraj OAuth Client (Web application)
2. Dodaj redirect URI:
   - `http://localhost:3000/api/auth/callback/google`
3. U `.env` postavi:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

#### Restrikcija domena
- `AUTH_ALLOWED_EMAIL_DOMAINS` (comma-separated), npr: `company.com,subsidiary.com`

#### Auto-provision (kreiranje korisnika preko SSO)
- `AUTH_AUTO_PROVISION=true` → prvi Google login može automatski kreirati korisnika u bazi
- `AUTH_AUTO_PROVISION=false` (default) → korisnik mora već postojati u bazi i biti `ACTIVE`

## Admin

Kao `ADMIN` korisnik imaš:
- `/admin/users` (korisnici, role, manager, tim, lozinke, carry-over godišnjeg)
- `/admin/teams` (timovi)
- `/admin/activity-types` (activity types po timu)
- `/admin/settings` (app settings key/value — boje, logo link, itd.)
- `/admin/import` (import iz starog Settings sheet-a preko copy/paste TSV)
