# FRP Tank Quoter

SaaS quoting tool for fiberglass reinforced plastic (FRP) chemical-storage tanks. A sales rep captures a customer RFI, configures a vessel (service, certifications, geometry, resin), and the tool produces a structured JSON spec for engineering — plus the scaffolding for future customer-facing PDFs and pricing.

**Status:** Walking skeleton (Plan 1 of 7). See `docs/superpowers/` for the full design and phased plan sequence.

## What's in V1 (this branch)

- Next.js 15 (App Router) + TypeScript + Tailwind
- Prisma + Postgres schema (Tenant, User, Customer, Project, Quote, Revision, AuditLog)
- Append-only `AuditLog` enforced via Postgres trigger
- NextAuth (email magic link) with role-based helpers (Sales / Engineer / Admin)
- 4-step configurator wizard (Customer & Project → Service & Certifications → Geometry → Resin)
- Rules engine stubs: chemical compatibility, certification filter (ASME RTP-1 class, NSF/ANSI 61, NSF/ANSI 2), wall-thickness lookup
- Hand-curated catalog: 4 resins (Derakane 411-350, 441-400, 470-300, Hetron 922) with certification metadata
- Engineering JSON output (schema v1.0.0) with download endpoint
- Review page with in-browser JSON preview
- Vitest unit tests (21 assertions) + Playwright e2e covering the full flow

## What's deferred to later plans

See `docs/superpowers/plans/2026-04-20-walking-skeleton.md` section "Out of scope" for the full list. The next plans will add: real ASCE 7 seismic/wind calcs + ASTM D3299/D4097/RTP-1 wall math (Plan 2), pricing engine + catalog versioning (Plan 3), customer PDF + engineering PDF datasheet (Plan 4), price-feed cron + supplier adapters (Plan 5), admin UIs + full RBAC enforcement (Plan 6), and the full 7-step wizard with nozzle schedule / accessories (Plan 7).

## Local development

Prereqs: Node 20+, npm, Postgres 16.

```bash
# Start Postgres (Homebrew example)
brew services start postgresql@16
createdb frp_tank_quoter

# Install and run migrations
npm install
cp .env.example .env
# edit .env if your DB URL differs from the default
npm run db:migrate
npm run db:seed

# Dev server
npm run dev
```

Open http://localhost:3000 → click sign-in → enter the seeded admin email (`admin@frp-tank-quoter.local` by default, or set `SEED_ADMIN_EMAIL` before seeding to use yours). Magic-link delivery requires a working SMTP in `.env` (`EMAIL_SERVER`, `EMAIL_FROM`). For local testing without SMTP, hit the dev-only `POST /api/test/login` endpoint with `{ "email": "..." }` to short-circuit auth.

## Tests

```bash
npm test              # Vitest unit tests (rules, RBAC, audit-log, JSON serializer)
npm run test:e2e      # Playwright — end-to-end walking-skeleton flow
```

The e2e test resets the database. Run against your dev Postgres, not production.

## Project structure

```
app/
  (auth)/sign-in/          # magic-link sign-in page
  (app)/                   # authenticated pages
    dashboard/             # quote list
    customers/             # customer CRUD
    projects/[id]/         # project detail
    quotes/[id]/rev/[L]/   # wizard: step-1..step-4, review, engineering.json
  api/auth/[...nextauth]/  # NextAuth handler
  api/test/login/          # DEV-ONLY session bypass (guarded by NODE_ENV)
lib/
  actions/                 # server actions (customers, projects, quotes, revisions)
  audit/                   # append-only audit log writer
  auth.ts                  # NextAuth config + tenantId injection adapter
  catalog/seed-data.ts     # V1 hand-curated resin catalog
  db.ts                    # Prisma singleton
  outputs/                 # engineering JSON serializer (schema v1.0.0)
  rbac.ts                  # role helpers
  rules/                   # chemistry + certification + wall-thickness stubs
  validators/              # Zod schemas
prisma/
  schema.prisma
  migrations/              # init + audit_log_append_only trigger
  seed.ts
tests/
  unit/                    # Vitest
  e2e/                     # Playwright
docs/superpowers/
  specs/2026-04-20-*       # design spec
  plans/2026-04-20-*       # phased implementation plans
```

## Deploy (Plan 1 target: Vercel + Neon)

Not yet configured. Provision a Neon Postgres branch, set `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_SERVER`, `EMAIL_FROM` in Vercel env vars. Run `npx prisma migrate deploy` against the Neon branch once before the first deploy; then push to deploy. See Task J2 in the walking-skeleton plan for the exact steps.

## Design & plans

- `docs/superpowers/specs/2026-04-20-frp-tank-quoter-design.md` — full V1 design
- `docs/superpowers/plans/2026-04-20-walking-skeleton.md` — this implementation plan
