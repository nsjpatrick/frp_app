# FRP Tank Quoter — Plan 1: Walking Skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployed Next.js app where a signed-in sales rep can create a customer, project, and quote, run a minimal 4-step configurator, and emit an Engineering JSON artifact. This is the first testable slice for a pilot user.

**Architecture:** Next.js 14 App Router + TypeScript + Prisma ORM + Postgres. NextAuth email magic-link auth. Server Actions for mutations. Rules engine stubs (lookup-table thickness, simple certification filter) — real ASCE 7 math comes in Plan 2. No PDFs in this plan. Deploy to Vercel + Neon Postgres.

**Tech Stack:** Next.js 14, TypeScript, React 18, Prisma 5, Postgres (Neon), NextAuth 5 (email provider), Tailwind CSS, Zod (validation), Vitest (unit), Playwright (e2e), pnpm.

**Out of scope (later plans):** ASCE 7 seismic/wind calcs, real wall-thickness math, pricing engine, PDF outputs, price-feed cron, catalog management UI, nozzle schedule editor, accessories picker, multi-revision diff view.

---

## File Structure Overview

```
frp-tank-quoter/
├── app/
│   ├── (auth)/
│   │   └── sign-in/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                      # auth guard + nav shell
│   │   ├── dashboard/page.tsx              # quote list
│   │   ├── customers/
│   │   │   ├── page.tsx                    # list
│   │   │   └── [id]/page.tsx               # detail + projects
│   │   ├── projects/[id]/page.tsx          # detail + quotes
│   │   └── quotes/
│   │       ├── new/page.tsx                # create
│   │       └── [quoteId]/rev/[revLabel]/
│   │           ├── page.tsx                # wizard entry
│   │           ├── step-1/page.tsx         # Customer & Project (auto-filled)
│   │           ├── step-2/page.tsx         # Service Conditions + Certifications
│   │           ├── step-3/page.tsx         # Geometry
│   │           ├── step-4/page.tsx         # Resin & Wall Buildup (stub)
│   │           └── review/page.tsx         # Review & Generate JSON
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts
│   └── layout.tsx
├── lib/
│   ├── db.ts                               # Prisma client singleton
│   ├── auth.ts                             # NextAuth config
│   ├── rbac.ts                             # role helpers
│   ├── rules/
│   │   ├── wall-thickness-stub.ts
│   │   ├── certification-filter.ts
│   │   └── index.ts
│   ├── catalog/
│   │   └── seed-data.ts                    # hand-curated V1 catalog
│   ├── outputs/
│   │   └── engineering-json.ts             # schema-v1 serializer
│   ├── audit/
│   │   └── audit-log.ts                    # append-only writer
│   └── actions/
│       ├── customers.ts                    # server actions
│       ├── projects.ts
│       ├── quotes.ts
│       └── revisions.ts
├── components/
│   ├── wizard/
│   │   ├── WizardShell.tsx                 # left nav + right rail
│   │   ├── LiveSummary.tsx                 # right rail placeholder
│   │   └── StepNav.tsx
│   └── forms/                              # reusable form primitives
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── tests/
│   ├── unit/
│   │   ├── rules/
│   │   └── outputs/
│   └── e2e/
│       └── walking-skeleton.spec.ts
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Phase A — Project Scaffolding

### Task A1: Initialize Next.js project with TypeScript and pnpm

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `app/layout.tsx`, `app/page.tsx`, `.env.example`, `README.md`

- [ ] **Step 1: Run Next.js scaffold in existing repo**

```bash
cd /Users/natepatrick/Documents/frp-tank-quoter
pnpm create next-app@latest . --ts --tailwind --app --src-dir=false --eslint --import-alias="@/*" --use-pnpm --yes
```

Answer prompts: TypeScript yes, Tailwind yes, src-dir no, App Router yes, import alias `@/*`.

- [ ] **Step 2: Verify dev server boots**

```bash
pnpm dev
```

Expected: terminal shows `Local: http://localhost:3000` with no errors. Ctrl-C to stop.

- [ ] **Step 3: Add .env.example**

Write `.env.example`:
```
DATABASE_URL="postgresql://user:pass@localhost:5432/frp_tank_quoter?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-only-replace-in-prod-min-32-chars"
EMAIL_SERVER="smtp://user:pass@smtp.mailtrap.io:2525"
EMAIL_FROM="quotes@frp-tank-quoter.local"
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js app with TypeScript and Tailwind"
```

### Task A2: Install core runtime dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Prisma, NextAuth, Zod**

```bash
pnpm add prisma @prisma/client next-auth@beta zod
pnpm add -D @types/node ts-node
```

- [ ] **Step 2: Install test tooling**

```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 3: Add scripts to package.json**

Edit `package.json` `scripts` block:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:migrate": "prisma migrate dev",
    "db:reset": "prisma migrate reset --force",
    "db:seed": "ts-node prisma/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: add Prisma, NextAuth, Zod, and test tooling"
```

### Task A3: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
});
```

- [ ] **Step 2: Create tests/setup.ts**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write a smoke test**

Create `tests/unit/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run and verify**

```bash
pnpm test
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/setup.ts tests/unit/smoke.test.ts
git commit -m "feat: configure Vitest with jsdom and smoke test"
```

### Task A4: Configure Playwright

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/.gitkeep`

- [ ] **Step 1: Create playwright.config.ts**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add playwright.config.ts tests/e2e/.gitkeep
git commit -m "feat: configure Playwright for e2e testing"
```

---

## Phase B — Database Schema

### Task B1: Write Prisma schema for core entities

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Write the schema**

Create `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())

  users     User[]
  customers Customer[]
}

model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String?
  role       Role     @default(SALES)
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  createdAt  DateTime @default(now())

  accounts   Account[]
  sessions   Session[]
}

enum Role {
  SALES
  ENGINEER
  ADMIN
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Customer {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  name      String
  contactName  String?
  contactEmail String?
  contactPhone String?
  createdAt DateTime @default(now())

  projects  Project[]

  @@index([tenantId])
}

model Project {
  id         String   @id @default(cuid())
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id])
  name       String
  customerProjectNumber String?
  siteAddress String?
  endUse     String?
  needByDate DateTime?
  createdAt  DateTime @default(now())

  quotes     Quote[]

  @@index([customerId])
}

model Quote {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id])
  number     String   @unique
  status     QuoteStatus @default(DRAFT)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  revisions  Revision[]

  @@index([projectId])
}

enum QuoteStatus {
  DRAFT
  SENT
  WON
  LOST
}

model Revision {
  id        String   @id @default(cuid())
  quoteId   String
  quote     Quote    @relation(fields: [quoteId], references: [id])
  label     String   // A, B, C, ...
  createdAt DateTime @default(now())

  service   Json?    // ServiceConditions
  site      Json?    // SeismicParameters + WindParameters
  certs     Json?    // CertificationRequirements
  geometry  Json?
  wallBuildup Json?
  outputs   Json?    // OutputArtifacts refs

  @@unique([quoteId, label])
  @@index([quoteId])
}

model AuditLog {
  id         String   @id @default(cuid())
  entityType String
  entityId   String
  revisionId String?
  actorUserId String
  action     String
  diffJson   Json
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([createdAt])
}
```

- [ ] **Step 2: Commit schema**

```bash
git add prisma/schema.prisma
git commit -m "feat: initial Prisma schema for tenants, customers, quotes, revisions, audit log"
```

### Task B2: Generate initial migration and Prisma client

**Files:**
- Create: `prisma/migrations/<timestamp>_init/migration.sql`
- Create: `lib/db.ts`

**Prerequisite:** Postgres running locally. If not available, run `docker run -d --name frp-pg -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=user -e POSTGRES_DB=frp_tank_quoter -p 5432:5432 postgres:16`.

- [ ] **Step 1: Create .env (not committed) with DATABASE_URL**

```bash
cp .env.example .env
# Edit .env DATABASE_URL to match local Postgres
```

- [ ] **Step 2: Run initial migration**

```bash
pnpm db:migrate --name init
```

Expected: migration created, Prisma client generated.

- [ ] **Step 3: Create lib/db.ts (client singleton)**

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations lib/db.ts
git commit -m "feat: initial migration and Prisma client singleton"
```

### Task B3: Append-only AuditLog enforcement via DB trigger

**Files:**
- Create: `prisma/migrations/<timestamp>_audit_log_append_only/migration.sql`
- Create: `tests/unit/audit/audit-log-append-only.test.ts` (integration)

- [ ] **Step 1: Create migration SQL**

Run `pnpm prisma migrate dev --create-only --name audit_log_append_only`. Edit the generated SQL:

```sql
CREATE OR REPLACE FUNCTION audit_log_block_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only; UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();
```

- [ ] **Step 2: Apply the migration**

```bash
pnpm db:migrate
```

- [ ] **Step 3: Write the failing test**

Create `tests/unit/audit/audit-log-append-only.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

describe('AuditLog append-only', () => {
  let created: { id: string };

  beforeAll(async () => {
    created = await db.auditLog.create({
      data: {
        entityType: 'Test',
        entityId: 'test-1',
        actorUserId: 'user-1',
        action: 'create',
        diffJson: {},
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('blocks UPDATE', async () => {
    await expect(
      db.auditLog.update({
        where: { id: created.id },
        data: { action: 'update' },
      })
    ).rejects.toThrow(/append-only/);
  });

  it('blocks DELETE', async () => {
    await expect(
      db.auditLog.delete({ where: { id: created.id } })
    ).rejects.toThrow(/append-only/);
  });
});
```

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm test tests/unit/audit/audit-log-append-only.test.ts
```

Expected: both assertions pass (the trigger blocks mutations).

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations tests/unit/audit/audit-log-append-only.test.ts
git commit -m "feat: enforce append-only AuditLog via Postgres trigger"
```

---

## Phase C — Authentication

### Task C1: NextAuth configuration with email magic link

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/(auth)/sign-in/page.tsx`

- [ ] **Step 1: Install NextAuth Prisma adapter and nodemailer**

```bash
pnpm add @auth/prisma-adapter nodemailer
pnpm add -D @types/nodemailer
```

- [ ] **Step 2: Create lib/auth.ts**

```ts
import NextAuth from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import type { Role } from '@prisma/client';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  pages: { signIn: '/sign-in' },
  callbacks: {
    session: async ({ session, user }) => {
      if (session.user) {
        const dbUser = await db.user.findUnique({ where: { id: user.id } });
        (session.user as any).id = user.id;
        (session.user as any).role = dbUser?.role ?? 'SALES';
        (session.user as any).tenantId = dbUser?.tenantId;
      }
      return session;
    },
  },
  session: { strategy: 'database' },
});

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  tenantId: string;
};
```

- [ ] **Step 3: Create API route handler**

Create `app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Create sign-in page**

Create `app/(auth)/sign-in/page.tsx`:
```tsx
'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <div className="max-w-sm mx-auto pt-24 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {sent ? (
        <p className="text-sm">Check your email for a sign-in link.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await signIn('email', { email, redirect: false });
            setSent(true);
          }}
          className="space-y-3"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded border px-3 py-2"
          />
          <button type="submit" className="w-full rounded bg-blue-600 text-white py-2">
            Send magic link
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wrap root layout with SessionProvider**

Edit `app/layout.tsx`:
```tsx
import './globals.css';
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts app/api app/\(auth\) app/layout.tsx package.json pnpm-lock.yaml
git commit -m "feat: NextAuth email magic-link authentication"
```

### Task C2: Authenticated app layout with nav shell

**Files:**
- Create: `app/(app)/layout.tsx`, `components/Nav.tsx`

- [ ] **Step 1: Create nav component**

Create `components/Nav.tsx`:
```tsx
import Link from 'next/link';
import { signOut } from 'next-auth/react';

export function Nav({ userEmail }: { userEmail: string }) {
  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-semibold">FRP Tank Quoter</Link>
        <Link href="/customers" className="text-sm text-gray-700">Customers</Link>
        <Link href="/dashboard" className="text-sm text-gray-700">Quotes</Link>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{userEmail}</span>
        <button onClick={() => signOut()} className="text-sm text-gray-700 underline">
          Sign out
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create authenticated layout with guard**

Create `app/(app)/layout.tsx`:
```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect('/sign-in');

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={session.user.email} />
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(app\) components/Nav.tsx
git commit -m "feat: authenticated app layout with nav shell"
```

### Task C3: RBAC helper

**Files:**
- Create: `lib/rbac.ts`, `tests/unit/rbac.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/rbac.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { requireRole, canSendFlaggedQuote } from '@/lib/rbac';

describe('requireRole', () => {
  it('allows equal or higher role', () => {
    expect(() => requireRole('SALES', 'SALES')).not.toThrow();
    expect(() => requireRole('ENGINEER', 'SALES')).not.toThrow();
    expect(() => requireRole('ADMIN', 'ENGINEER')).not.toThrow();
  });

  it('throws on lower role', () => {
    expect(() => requireRole('SALES', 'ADMIN')).toThrow(/insufficient role/i);
    expect(() => requireRole('ENGINEER', 'ADMIN')).toThrow();
  });
});

describe('canSendFlaggedQuote', () => {
  it('true for ENGINEER and ADMIN', () => {
    expect(canSendFlaggedQuote('ENGINEER')).toBe(true);
    expect(canSendFlaggedQuote('ADMIN')).toBe(true);
  });
  it('false for SALES', () => {
    expect(canSendFlaggedQuote('SALES')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/unit/rbac.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement lib/rbac.ts**

```ts
import type { Role } from '@prisma/client';

const RANK: Record<Role, number> = { SALES: 1, ENGINEER: 2, ADMIN: 3 };

export function requireRole(actual: Role, required: Role): void {
  if (RANK[actual] < RANK[required]) {
    throw new Error(`insufficient role: needed ${required}, got ${actual}`);
  }
}

export function canSendFlaggedQuote(role: Role): boolean {
  return RANK[role] >= RANK.ENGINEER;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm test tests/unit/rbac.test.ts
```

Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/rbac.ts tests/unit/rbac.test.ts
git commit -m "feat: RBAC helpers for role checks and flag-send permission"
```

---

## Phase D — Seed Data and Stub Catalog

### Task D1: Hand-curated V1 catalog seed data

**Files:**
- Create: `lib/catalog/seed-data.ts`

- [ ] **Step 1: Create seed-data.ts**

```ts
// V1 hand-curated mini catalog. Real catalog management UI arrives in Plan 6.
// Citations: Ashland Derakane Chemical Resistance Guide (2021), Hetron PPG (2020).

export type ResinCertifications = {
  nsf_ansi_61: { listed: boolean; max_temp_F?: number; listing_ref?: string };
  nsf_ansi_2: { listed: boolean; listing_ref?: string };
  asme_rtp1_class_eligibility: Array<'I' | 'II' | 'III'>;
};

export type SeedResin = {
  id: string;
  name: string;
  supplier: string;
  family: 'vinyl_ester' | 'bis_a_epoxy' | 'iso_polyester' | 'novolac';
  max_service_temp_F: number;
  density_lb_ft3: number;
  price_per_lb: number;
  compatible_chemical_families: string[];
  certifications: ResinCertifications;
};

export const SEED_RESINS: SeedResin[] = [
  {
    id: 'derakane-411-350',
    name: 'Derakane 411-350',
    supplier: 'Ashland',
    family: 'vinyl_ester',
    max_service_temp_F: 220,
    density_lb_ft3: 68,
    price_per_lb: 2.85,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'chlorinated_water', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 180, listing_ref: 'NSF 61 listing: Ashland Derakane 411-350 rev 2021' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'derakane-441-400',
    name: 'Derakane 441-400',
    supplier: 'Ashland',
    family: 'vinyl_ester',
    max_service_temp_F: 240,
    density_lb_ft3: 69,
    price_per_lb: 3.20,
    compatible_chemical_families: ['concentrated_acid', 'oxidizing_acid', 'chlorinated_water'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
  {
    id: 'derakane-470-300',
    name: 'Derakane 470-300',
    supplier: 'Ashland',
    family: 'novolac',
    max_service_temp_F: 300,
    density_lb_ft3: 70,
    price_per_lb: 3.85,
    compatible_chemical_families: ['solvent', 'hot_acid', 'hypochlorite'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
  {
    id: 'hetron-922',
    name: 'Hetron 922',
    supplier: 'AOC',
    family: 'vinyl_ester',
    max_service_temp_F: 210,
    density_lb_ft3: 67,
    price_per_lb: 2.70,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 160, listing_ref: 'NSF 61 listing: AOC Hetron 922 rev 2020' },
      nsf_ansi_2: { listed: true, listing_ref: 'NSF 2 listing: AOC Hetron 922 rev 2020' },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
];

export const CHEMICAL_FAMILIES = [
  'dilute_acid',
  'concentrated_acid',
  'oxidizing_acid',
  'caustic',
  'solvent',
  'hot_acid',
  'hypochlorite',
  'chlorinated_water',
  'potable_water',
] as const;

export type ChemicalFamily = typeof CHEMICAL_FAMILIES[number];
```

- [ ] **Step 2: Commit**

```bash
git add lib/catalog/seed-data.ts
git commit -m "feat: hand-curated V1 catalog with 4 resins and certification metadata"
```

### Task D2: Prisma seed script for dev Tenant + first Admin

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (already has db:seed script)

- [ ] **Step 1: Create prisma/seed.ts**

```ts
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.upsert({
    where: { id: 'mock-plas-tanks' },
    update: {},
    create: { id: 'mock-plas-tanks', name: 'Plas-Tanks Industries (mock)' },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@frp-tank-quoter.local';
  await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Seed Admin',
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  });

  console.log(`Seeded tenant ${tenant.id} and admin ${adminEmail}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
```

- [ ] **Step 2: Run seed**

```bash
pnpm db:seed
```

Expected: console log `Seeded tenant mock-plas-tanks and admin ...`.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed script for mock tenant and admin user"
```

---

## Phase E — Rules Engine Stubs

### Task E1: Certification filter

**Files:**
- Create: `lib/rules/certification-filter.ts`, `tests/unit/rules/certification-filter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/rules/certification-filter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { filterByCertifications, type CertificationRequirements } from '@/lib/rules/certification-filter';
import { SEED_RESINS } from '@/lib/catalog/seed-data';

describe('filterByCertifications', () => {
  it('returns all when no requirements set', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: false,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 120);
    expect(result).toHaveLength(SEED_RESINS.length);
  });

  it('filters to NSF/ANSI 61 listed at adequate temp', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: true,
      nsf_ansi_61_target_temp_F: 150,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 150);
    // Derakane 411-350 listed to 180°F (passes); Hetron 922 listed to 160°F (passes).
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(['derakane-411-350', 'hetron-922']);
  });

  it('filters further by NSF/ANSI 61 target temp above listing max', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: true,
      nsf_ansi_61_target_temp_F: 190,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 190);
    // 411-350 maxes at 180 — out. Hetron 922 at 160 — out.
    expect(result).toHaveLength(0);
  });

  it('filters by NSF/ANSI 2', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: false,
      nsf_ansi_2_required: true,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 120);
    expect(result.map((r) => r.id)).toEqual(['hetron-922']);
  });

  it('filters by ASME RTP-1 class', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: 'III',
      ansi_standards: [],
      nsf_ansi_61_required: false,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 120);
    // 411-350 is I/II only; 441-400 and 470-300 include III; hetron is I/II.
    expect(result.map((r) => r.id).sort()).toEqual(['derakane-441-400', 'derakane-470-300']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/unit/rules/certification-filter.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement certification-filter.ts**

Create `lib/rules/certification-filter.ts`:
```ts
import type { SeedResin } from '@/lib/catalog/seed-data';

export type CertificationRequirements = {
  asme_rtp1_class: 'I' | 'II' | 'III' | null;
  ansi_standards: Array<{ code: string; revision: string; scope?: string }>;
  nsf_ansi_61_required: boolean;
  nsf_ansi_61_target_temp_F?: number;
  nsf_ansi_2_required: boolean;
};

export function filterByCertifications(
  resins: SeedResin[],
  reqs: CertificationRequirements,
  designTempF: number,
): SeedResin[] {
  return resins.filter((r) => {
    if (reqs.nsf_ansi_61_required) {
      if (!r.certifications.nsf_ansi_61.listed) return false;
      const listingMax = r.certifications.nsf_ansi_61.max_temp_F ?? -Infinity;
      const targetTemp = reqs.nsf_ansi_61_target_temp_F ?? designTempF;
      if (listingMax < targetTemp) return false;
    }
    if (reqs.nsf_ansi_2_required && !r.certifications.nsf_ansi_2.listed) return false;
    if (reqs.asme_rtp1_class &&
        !r.certifications.asme_rtp1_class_eligibility.includes(reqs.asme_rtp1_class)) {
      return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm test tests/unit/rules/certification-filter.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/rules/certification-filter.ts tests/unit/rules/certification-filter.test.ts
git commit -m "feat: certification filter for resin eligibility"
```

### Task E2: Chemical compatibility filter (stub)

**Files:**
- Create: `lib/rules/compatibility.ts`, `tests/unit/rules/compatibility.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/rules/compatibility.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { filterByChemistry } from '@/lib/rules/compatibility';
import { SEED_RESINS } from '@/lib/catalog/seed-data';

describe('filterByChemistry', () => {
  it('filters to resins whose family supports the chemical and temp', () => {
    const result = filterByChemistry(SEED_RESINS, 'dilute_acid', 120);
    expect(result.map((r) => r.id).sort()).toEqual(['derakane-411-350', 'hetron-922']);
  });

  it('excludes resins below design temperature', () => {
    const result = filterByChemistry(SEED_RESINS, 'dilute_acid', 230);
    expect(result).toHaveLength(0);
  });

  it('handles unknown chemical family by returning empty', () => {
    const result = filterByChemistry(SEED_RESINS, 'fictional_chemical' as any, 120);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm test tests/unit/rules/compatibility.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement compatibility.ts**

```ts
import type { SeedResin, ChemicalFamily } from '@/lib/catalog/seed-data';

export function filterByChemistry(
  resins: SeedResin[],
  chemicalFamily: ChemicalFamily,
  designTempF: number,
): SeedResin[] {
  return resins.filter(
    (r) =>
      r.compatible_chemical_families.includes(chemicalFamily) &&
      r.max_service_temp_F >= designTempF,
  );
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm test tests/unit/rules/compatibility.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/rules/compatibility.ts tests/unit/rules/compatibility.test.ts
git commit -m "feat: chemical-family + temperature compatibility filter stub"
```

### Task E3: Wall thickness stub (lookup table)

**Files:**
- Create: `lib/rules/wall-thickness-stub.ts`, `tests/unit/rules/wall-thickness-stub.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/rules/wall-thickness-stub.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { estimateWallThickness } from '@/lib/rules/wall-thickness-stub';

describe('estimateWallThickness (stub)', () => {
  it('returns thicker wall for larger diameter', () => {
    const small = estimateWallThickness({ idIn: 48, ssHeightIn: 96, specificGravity: 1.2 });
    const big = estimateWallThickness({ idIn: 144, ssHeightIn: 144, specificGravity: 1.2 });
    expect(big.shellThicknessIn).toBeGreaterThan(small.shellThicknessIn);
  });

  it('scales shell thickness with specific gravity', () => {
    const light = estimateWallThickness({ idIn: 120, ssHeightIn: 144, specificGravity: 1.0 });
    const heavy = estimateWallThickness({ idIn: 120, ssHeightIn: 144, specificGravity: 1.8 });
    expect(heavy.shellThicknessIn).toBeGreaterThan(light.shellThicknessIn);
  });

  it('flags as stub in result metadata', () => {
    const r = estimateWallThickness({ idIn: 120, ssHeightIn: 144, specificGravity: 1.4 });
    expect(r.engineVersion).toBe('wall-thickness-stub-v0');
    expect(r.governingRule).toBe('stub-lookup');
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm test tests/unit/rules/wall-thickness-stub.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement wall-thickness-stub.ts**

```ts
export type WallThicknessInput = {
  idIn: number;
  ssHeightIn: number;
  specificGravity: number;
};

export type WallThicknessResult = {
  shellThicknessIn: number;
  headThicknessIn: number;
  governingRule: string;
  engineVersion: string;
};

// Stub: piecewise linear estimate. Real ASTM D3299 / RTP-1 math in Plan 2.
export function estimateWallThickness(input: WallThicknessInput): WallThicknessResult {
  const diameterFactor = Math.max(0.25, input.idIn / 240); // 1" thick at 20 ft ID baseline
  const sgFactor = Math.max(0.8, input.specificGravity);
  const shell = +(diameterFactor * sgFactor).toFixed(3);
  const head = +(shell * 1.15).toFixed(3);

  return {
    shellThicknessIn: shell,
    headThicknessIn: head,
    governingRule: 'stub-lookup',
    engineVersion: 'wall-thickness-stub-v0',
  };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm test tests/unit/rules/wall-thickness-stub.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/rules/wall-thickness-stub.ts tests/unit/rules/wall-thickness-stub.test.ts
git commit -m "feat: wall-thickness stub returning lookup-based estimates"
```

### Task E4: Rules engine barrel export

**Files:**
- Create: `lib/rules/index.ts`

- [ ] **Step 1: Create barrel**

```ts
export * from './certification-filter';
export * from './compatibility';
export * from './wall-thickness-stub';

export const RULES_ENGINE_VERSION = '0.1.0-walking-skeleton';
```

- [ ] **Step 2: Commit**

```bash
git add lib/rules/index.ts
git commit -m "feat: rules engine barrel export with version constant"
```

---

## Phase F — Server Actions for Core Entities

### Task F1: Zod schemas for server actions

**Files:**
- Create: `lib/validators/entities.ts`

- [ ] **Step 1: Create validators**

```ts
import { z } from 'zod';

export const customerCreateSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().max(40).optional(),
});

export const projectCreateSchema = z.object({
  customerId: z.string().cuid(),
  name: z.string().min(1).max(200),
  customerProjectNumber: z.string().max(80).optional(),
  siteAddress: z.string().max(500).optional(),
  endUse: z.string().max(500).optional(),
  needByDate: z.string().optional(),
});

export const quoteCreateSchema = z.object({
  projectId: z.string().cuid(),
});

export const serviceConditionsSchema = z.object({
  chemical: z.string().min(1),
  chemicalFamily: z.string(),
  concentrationPct: z.number().min(0).max(100).optional(),
  operatingTempF: z.number(),
  designTempF: z.number(),
  specificGravity: z.number().positive(),
  operatingPressurePsig: z.number(),
  vacuumPsig: z.number().nonnegative(),
});

export const certificationRequirementsSchema = z.object({
  asmeRtp1Class: z.enum(['I', 'II', 'III']).nullable(),
  asmeRtp1StdRevision: z.string().optional(),
  ansiStandards: z.array(z.object({
    code: z.string(),
    revision: z.string(),
    scope: z.string().optional(),
  })),
  nsfAnsi61Required: z.boolean(),
  nsfAnsi61TargetTempF: z.number().optional(),
  nsfAnsi2Required: z.boolean(),
  thirdPartyInspector: z.enum(['TUV', 'LLOYDS', 'INTERTEK', 'NONE']).default('NONE'),
  requiredDocuments: z.array(z.string()),
});

export const siteEnvSchema = z.object({
  indoor: z.boolean(),
  seismic: z.object({
    siteClass: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
    Ss: z.number(),
    S1: z.number(),
    Ie: z.number(),
    riskCategory: z.enum(['I', 'II', 'III', 'IV']),
  }),
  wind: z.object({
    V: z.number(),
    exposure: z.enum(['B', 'C', 'D']),
    Kzt: z.number(),
    riskCategory: z.enum(['I', 'II', 'III', 'IV']),
  }),
});

export const geometrySchema = z.object({
  orientation: z.enum(['vertical', 'horizontal']),
  idIn: z.number().positive(),
  ssHeightIn: z.number().positive(),
  topHead: z.enum(['flat', 'F_AND_D', 'conical', 'open_top_cover']),
  bottom: z.enum(['flat_ring_supported', 'dished', 'conical_drain', 'sloped']),
  freeboardIn: z.number().nonnegative(),
});
```

- [ ] **Step 2: Commit**

```bash
git add lib/validators/entities.ts
git commit -m "feat: Zod validators for customer, project, quote, service, certs, geometry"
```

### Task F2: Audit log writer

**Files:**
- Create: `lib/audit/audit-log.ts`, `tests/unit/audit/audit-log-writer.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/audit/audit-log-writer.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { writeAuditEntry } from '@/lib/audit/audit-log';

const db = new PrismaClient();

describe('writeAuditEntry', () => {
  afterAll(() => db.$disconnect());

  it('persists an entry', async () => {
    const entry = await writeAuditEntry(db, {
      entityType: 'Customer',
      entityId: 'test-cust',
      actorUserId: 'test-user',
      action: 'create',
      diffJson: { name: { from: null, to: 'Acme' } },
    });
    expect(entry.id).toBeTruthy();

    const row = await db.auditLog.findUnique({ where: { id: entry.id } });
    expect(row?.action).toBe('create');
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm test tests/unit/audit/audit-log-writer.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement writer**

Create `lib/audit/audit-log.ts`:
```ts
import type { PrismaClient } from '@prisma/client';

export type AuditEntryInput = {
  entityType: string;
  entityId: string;
  revisionId?: string;
  actorUserId: string;
  action: string;
  diffJson: Record<string, unknown>;
};

export async function writeAuditEntry(db: PrismaClient, input: AuditEntryInput) {
  return db.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      revisionId: input.revisionId,
      actorUserId: input.actorUserId,
      action: input.action,
      diffJson: input.diffJson as any,
    },
  });
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm test tests/unit/audit/audit-log-writer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/audit/audit-log.ts tests/unit/audit
git commit -m "feat: audit-log writer with tenant-safe entry creation"
```

### Task F3: Customer server actions

**Files:**
- Create: `lib/actions/customers.ts`

- [ ] **Step 1: Implement server actions**

```ts
'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { customerCreateSchema } from '@/lib/validators/entities';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function getSessionUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user as { id: string; tenantId: string; role: 'SALES' | 'ENGINEER' | 'ADMIN' };
}

export async function createCustomer(formData: FormData) {
  const user = await getSessionUser();
  const parsed = customerCreateSchema.parse({
    name: formData.get('name'),
    contactName: formData.get('contactName') || undefined,
    contactEmail: formData.get('contactEmail') || undefined,
    contactPhone: formData.get('contactPhone') || undefined,
  });

  const customer = await db.customer.create({
    data: { ...parsed, tenantId: user.tenantId },
  });

  await writeAuditEntry(db, {
    entityType: 'Customer',
    entityId: customer.id,
    actorUserId: user.id,
    action: 'create',
    diffJson: parsed,
  });

  revalidatePath('/customers');
  redirect(`/customers/${customer.id}`);
}

export async function listCustomers() {
  const user = await getSessionUser();
  return db.customer.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' },
    include: { projects: { select: { id: true, name: true } } },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/customers.ts
git commit -m "feat: customer server actions with audit logging"
```

### Task F4: Project and Quote server actions

**Files:**
- Create: `lib/actions/projects.ts`, `lib/actions/quotes.ts`, `lib/actions/revisions.ts`

- [ ] **Step 1: Create lib/actions/projects.ts**

```ts
'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { projectCreateSchema } from '@/lib/validators/entities';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { redirect } from 'next/navigation';

async function getUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user;
}

export async function createProject(formData: FormData) {
  const user = await getUser();
  const parsed = projectCreateSchema.parse({
    customerId: formData.get('customerId'),
    name: formData.get('name'),
    customerProjectNumber: formData.get('customerProjectNumber') || undefined,
    siteAddress: formData.get('siteAddress') || undefined,
    endUse: formData.get('endUse') || undefined,
    needByDate: formData.get('needByDate') || undefined,
  });

  const project = await db.project.create({
    data: {
      ...parsed,
      needByDate: parsed.needByDate ? new Date(parsed.needByDate) : null,
    },
  });

  await writeAuditEntry(db, {
    entityType: 'Project',
    entityId: project.id,
    actorUserId: user.id,
    action: 'create',
    diffJson: parsed,
  });

  redirect(`/projects/${project.id}`);
}
```

- [ ] **Step 2: Create lib/actions/quotes.ts**

```ts
'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { redirect } from 'next/navigation';

async function getUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user;
}

function quoteNumber(): string {
  const y = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `Q-${y}-${rand}`;
}

export async function createQuote(formData: FormData) {
  const user = await getUser();
  const projectId = String(formData.get('projectId'));
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { customer: true },
  });
  if (!project || project.customer.tenantId !== user.tenantId) throw new Error('not found');

  const quote = await db.quote.create({
    data: { projectId, number: quoteNumber() },
  });

  const rev = await db.revision.create({
    data: { quoteId: quote.id, label: 'A' },
  });

  await writeAuditEntry(db, {
    entityType: 'Quote',
    entityId: quote.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'create',
    diffJson: { number: quote.number },
  });

  redirect(`/quotes/${quote.id}/rev/${rev.label}/step-1`);
}
```

- [ ] **Step 3: Create lib/actions/revisions.ts**

```ts
'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { serviceConditionsSchema, certificationRequirementsSchema, siteEnvSchema, geometrySchema } from '@/lib/validators/entities';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { redirect } from 'next/navigation';

async function getUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user;
}

async function loadRevision(quoteId: string, label: string, tenantId: string) {
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== tenantId) throw new Error('not found');
  return rev;
}

export async function saveServiceStep(quoteId: string, label: string, formData: FormData) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);

  const service = serviceConditionsSchema.parse({
    chemical: formData.get('chemical'),
    chemicalFamily: formData.get('chemicalFamily'),
    concentrationPct: formData.get('concentrationPct') ? Number(formData.get('concentrationPct')) : undefined,
    operatingTempF: Number(formData.get('operatingTempF')),
    designTempF: Number(formData.get('designTempF')),
    specificGravity: Number(formData.get('specificGravity')),
    operatingPressurePsig: Number(formData.get('operatingPressurePsig')),
    vacuumPsig: Number(formData.get('vacuumPsig')),
  });

  const certs = certificationRequirementsSchema.parse({
    asmeRtp1Class: formData.get('asmeRtp1Class') || null,
    asmeRtp1StdRevision: formData.get('asmeRtp1StdRevision') || undefined,
    ansiStandards: JSON.parse(String(formData.get('ansiStandards') || '[]')),
    nsfAnsi61Required: formData.get('nsfAnsi61Required') === 'on',
    nsfAnsi61TargetTempF: formData.get('nsfAnsi61TargetTempF') ? Number(formData.get('nsfAnsi61TargetTempF')) : undefined,
    nsfAnsi2Required: formData.get('nsfAnsi2Required') === 'on',
    thirdPartyInspector: (formData.get('thirdPartyInspector') || 'NONE') as any,
    requiredDocuments: JSON.parse(String(formData.get('requiredDocuments') || '[]')),
  });

  const site = siteEnvSchema.parse(JSON.parse(String(formData.get('siteJson'))));

  await db.revision.update({
    where: { id: rev.id },
    data: { service, certs, site },
  });

  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: rev.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'update:service+certs+site',
    diffJson: { service, certs, site },
  });

  redirect(`/quotes/${quoteId}/rev/${label}/step-3`);
}

export async function saveGeometryStep(quoteId: string, label: string, formData: FormData) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);

  const geometry = geometrySchema.parse({
    orientation: formData.get('orientation'),
    idIn: Number(formData.get('idIn')),
    ssHeightIn: Number(formData.get('ssHeightIn')),
    topHead: formData.get('topHead'),
    bottom: formData.get('bottom'),
    freeboardIn: Number(formData.get('freeboardIn')),
  });

  await db.revision.update({ where: { id: rev.id }, data: { geometry } });
  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: rev.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'update:geometry',
    diffJson: { geometry },
  });

  redirect(`/quotes/${quoteId}/rev/${label}/step-4`);
}

export async function saveResinStep(quoteId: string, label: string, formData: FormData) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);
  const resinId = String(formData.get('resinId'));

  await db.revision.update({ where: { id: rev.id }, data: { wallBuildup: { resinId } } });
  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: rev.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'update:resin',
    diffJson: { resinId },
  });

  redirect(`/quotes/${quoteId}/rev/${label}/review`);
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions
git commit -m "feat: server actions for projects, quotes, and revision wizard steps"
```

---

## Phase G — Engineering JSON Output

### Task G1: Engineering JSON serializer (schema v1.0.0)

**Files:**
- Create: `lib/outputs/engineering-json.ts`, `tests/unit/outputs/engineering-json.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/outputs/engineering-json.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildEngineeringJson } from '@/lib/outputs/engineering-json';

const fixture = {
  quote: { id: 'q1', number: 'Q-2026-0001', project: { id: 'p1', name: 'Test', customer: { id: 'c1', name: 'Acme', contactName: 'Jane', contactEmail: 'j@acme', contactPhone: '555' }, siteAddress: '123 Main', endUse: 'storage', needByDate: null } },
  revision: {
    id: 'r1',
    label: 'A',
    service: { chemical: 'H2SO4', chemicalFamily: 'dilute_acid', concentrationPct: 50, operatingTempF: 120, designTempF: 140, specificGravity: 1.4, operatingPressurePsig: 0, vacuumPsig: 0 },
    site: { indoor: false, seismic: { siteClass: 'D', Ss: 1.2, S1: 0.4, Ie: 1.0, riskCategory: 'II' }, wind: { V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II' } },
    certs: { asmeRtp1Class: 'II', asmeRtp1StdRevision: 'RTP-1:2019', ansiStandards: [], nsfAnsi61Required: false, nsfAnsi2Required: false, thirdPartyInspector: 'NONE', requiredDocuments: [] },
    geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, topHead: 'F_AND_D', bottom: 'flat_ring_supported', freeboardIn: 12 },
    wallBuildup: { resinId: 'derakane-411-350' },
  },
} as const;

describe('buildEngineeringJson', () => {
  it('produces schema_version 1.0.0 and required blocks', () => {
    const json = buildEngineeringJson(fixture as any, { rulesEngineVersion: '0.1.0', catalogSnapshotId: 'seed-v0' });
    expect(json.schema_version).toBe('1.0.0');
    expect(json.quote_id).toBe('Q-2026-0001');
    expect(json.revision).toBe('A');
    expect(json.customer.name).toBe('Acme');
    expect(json.service.chemical).toBe('H2SO4');
    expect(json.site.seismic.Ss).toBe(1.2);
    expect(json.certifications.asme_rtp1.class).toBe('II');
    expect(json.geometry.id_in).toBe(120);
    expect(json.wall_buildup.corrosion_barrier.resin).toBe('derakane-411-350');
    expect(json.rules_engine_version).toBe('0.1.0');
    expect(json.catalog_snapshot_id).toBe('seed-v0');
  });

  it('produces deterministic output (identical JSON for identical inputs)', () => {
    const a = buildEngineeringJson(fixture as any, { rulesEngineVersion: '0.1.0', catalogSnapshotId: 'seed-v0' });
    const b = buildEngineeringJson(fixture as any, { rulesEngineVersion: '0.1.0', catalogSnapshotId: 'seed-v0' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
pnpm test tests/unit/outputs/engineering-json.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement serializer**

Create `lib/outputs/engineering-json.ts`:
```ts
export type EngineeringJsonOpts = {
  rulesEngineVersion: string;
  catalogSnapshotId: string;
  generatedAt?: string;
};

export type EngineeringJson = ReturnType<typeof buildEngineeringJson>;

export function buildEngineeringJson(
  src: {
    quote: {
      id: string;
      number: string;
      project: {
        id: string;
        name: string;
        customer: { id: string; name: string; contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null };
        siteAddress?: string | null;
        endUse?: string | null;
        needByDate?: Date | null;
      };
    };
    revision: {
      id: string;
      label: string;
      service: any;
      site: any;
      certs: any;
      geometry: any;
      wallBuildup: any;
    };
  },
  opts: EngineeringJsonOpts,
) {
  const rev = src.revision;
  const proj = src.quote.project;
  const cust = proj.customer;

  return {
    schema_version: '1.0.0',
    quote_id: src.quote.number,
    revision: rev.label,
    generated_at: opts.generatedAt ?? new Date().toISOString(),
    rules_engine_version: opts.rulesEngineVersion,
    catalog_snapshot_id: opts.catalogSnapshotId,

    customer: {
      name: cust.name,
      contact_name: cust.contactName ?? null,
      contact_email: cust.contactEmail ?? null,
      contact_phone: cust.contactPhone ?? null,
    },
    project: {
      name: proj.name,
      site_address: proj.siteAddress ?? null,
      end_use: proj.endUse ?? null,
      need_by_date: proj.needByDate ? proj.needByDate.toISOString() : null,
    },

    service: {
      chemical: rev.service.chemical,
      chemical_family: rev.service.chemicalFamily,
      concentration_pct: rev.service.concentrationPct ?? null,
      operating_temp_F: rev.service.operatingTempF,
      design_temp_F: rev.service.designTempF,
      specific_gravity: rev.service.specificGravity,
      operating_pressure_psig: rev.service.operatingPressurePsig,
      vacuum_psig: rev.service.vacuumPsig,
    },

    site: {
      indoor: rev.site.indoor,
      seismic: rev.site.seismic,
      wind: rev.site.wind,
    },

    certifications: {
      asme_rtp1: rev.certs.asmeRtp1Class
        ? { class: rev.certs.asmeRtp1Class, std_revision: rev.certs.asmeRtp1StdRevision ?? 'RTP-1:2019' }
        : null,
      ansi_standards: rev.certs.ansiStandards,
      nsf_ansi_61: rev.certs.nsfAnsi61Required
        ? { required: true, target_end_use_temp_F: rev.certs.nsfAnsi61TargetTempF ?? rev.service.designTempF }
        : { required: false },
      nsf_ansi_2: { required: rev.certs.nsfAnsi2Required },
      third_party_inspector: rev.certs.thirdPartyInspector,
      required_documents: rev.certs.requiredDocuments,
    },

    geometry: {
      orientation: rev.geometry.orientation,
      id_in: rev.geometry.idIn,
      ss_height_in: rev.geometry.ssHeightIn,
      top_head: rev.geometry.topHead,
      bottom: rev.geometry.bottom,
      freeboard_in: rev.geometry.freeboardIn,
    },

    wall_buildup: {
      corrosion_barrier: {
        resin: rev.wallBuildup?.resinId ?? null,
      },
      structural: {
        total_thickness_in: null,
      },
    },

    structural_analysis: null,
    nozzles: [],
    accessories: [],
    anchorage: null,
    flags: [],
    pricing: null,

    checksum_sha256: null,
  };
}
```

Note: deterministic JSON stringification is guaranteed because property order in an object literal is preserved by `JSON.stringify` in modern JS engines. The test validates equal output for equal input, which is what matters.

- [ ] **Step 4: Run to verify pass**

```bash
pnpm test tests/unit/outputs/engineering-json.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/outputs/engineering-json.ts tests/unit/outputs
git commit -m "feat: engineering JSON serializer (schema v1.0.0)"
```

### Task G2: API route to fetch Engineering JSON

**Files:**
- Create: `app/(app)/quotes/[quoteId]/rev/[revLabel]/engineering.json/route.ts`

- [ ] **Step 1: Create route**

```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildEngineeringJson } from '@/lib/outputs/engineering-json';
import { RULES_ENGINE_VERSION } from '@/lib/rules';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: { quoteId: string; revLabel: string } },
) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId: params.quoteId, label: params.revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) {
    return new NextResponse('Not found', { status: 404 });
  }

  const json = buildEngineeringJson(
    { quote: rev.quote, revision: rev } as any,
    { rulesEngineVersion: RULES_ENGINE_VERSION, catalogSnapshotId: 'seed-v0' },
  );

  return NextResponse.json(json, {
    headers: { 'Content-Disposition': `attachment; filename="${rev.quote.number}-Rev${rev.label}.json"` },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add 'app/(app)/quotes/[quoteId]/rev/[revLabel]/engineering.json'
git commit -m "feat: download endpoint for engineering JSON"
```

---

## Phase H — Minimal UI

### Task H1: Dashboard and Customers list page

**Files:**
- Create: `app/(app)/dashboard/page.tsx`, `app/(app)/customers/page.tsx`

- [ ] **Step 1: Create dashboard**

```tsx
import Link from 'next/link';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export default async function Dashboard() {
  const session = await auth();
  const user = session?.user as any;
  const quotes = await db.quote.findMany({
    where: { project: { customer: { tenantId: user.tenantId } } },
    include: { project: { include: { customer: true } }, revisions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Quotes</h1>
        <Link href="/customers" className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm">
          New customer
        </Link>
      </div>
      <table className="w-full bg-white border rounded">
        <thead className="text-left text-xs uppercase text-gray-500 border-b">
          <tr>
            <th className="p-3">Quote</th>
            <th className="p-3">Customer</th>
            <th className="p-3">Project</th>
            <th className="p-3">Status</th>
            <th className="p-3">Rev</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id} className="border-t">
              <td className="p-3 font-mono text-sm">{q.number}</td>
              <td className="p-3">{q.project.customer.name}</td>
              <td className="p-3">{q.project.name}</td>
              <td className="p-3">{q.status}</td>
              <td className="p-3">{q.revisions[0]?.label ?? '—'}</td>
              <td className="p-3 text-right">
                {q.revisions[0] && (
                  <Link href={`/quotes/${q.id}/rev/${q.revisions[0].label}/review`} className="text-blue-600 text-sm">
                    Open
                  </Link>
                )}
              </td>
            </tr>
          ))}
          {quotes.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-gray-500">
                No quotes yet. Start by creating a customer.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create customers list + create form**

Create `app/(app)/customers/page.tsx`:
```tsx
import Link from 'next/link';
import { listCustomers, createCustomer } from '@/lib/actions/customers';

export default async function Customers() {
  const customers = await listCustomers();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customers</h1>

      <form action={createCustomer} className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">New Customer</h2>
        <div className="grid grid-cols-2 gap-3">
          <input name="name" placeholder="Company name" required className="rounded border px-3 py-2" />
          <input name="contactName" placeholder="Contact name" className="rounded border px-3 py-2" />
          <input name="contactEmail" placeholder="Contact email" className="rounded border px-3 py-2" />
          <input name="contactPhone" placeholder="Contact phone" className="rounded border px-3 py-2" />
        </div>
        <button className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm">Create</button>
      </form>

      <table className="w-full bg-white border rounded">
        <thead className="text-left text-xs uppercase text-gray-500 border-b">
          <tr><th className="p-3">Name</th><th className="p-3">Contact</th><th className="p-3">Projects</th><th></th></tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-3">{c.name}</td>
              <td className="p-3 text-sm text-gray-600">{c.contactName ?? '—'}</td>
              <td className="p-3 text-sm">{c.projects.length}</td>
              <td className="p-3 text-right">
                <Link href={`/customers/${c.id}`} className="text-blue-600 text-sm">Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add 'app/(app)/dashboard' 'app/(app)/customers/page.tsx'
git commit -m "feat: dashboard and customers list page"
```

### Task H2: Customer detail + project creation

**Files:**
- Create: `app/(app)/customers/[id]/page.tsx`, `app/(app)/projects/[id]/page.tsx`

- [ ] **Step 1: Customer detail page**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { createProject } from '@/lib/actions/projects';

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  const customer = await db.customer.findUnique({
    where: { id: params.id },
    include: { projects: { orderBy: { createdAt: 'desc' }, include: { quotes: { select: { id: true, number: true, status: true } } } } },
  });
  if (!customer || customer.tenantId !== user.tenantId) notFound();

  return (
    <div className="space-y-6">
      <div><Link href="/customers" className="text-sm text-blue-600">← Customers</Link></div>
      <h1 className="text-2xl font-semibold">{customer.name}</h1>
      <p className="text-gray-600">{customer.contactName} · {customer.contactEmail} · {customer.contactPhone}</p>

      <form action={createProject} className="bg-white border rounded p-4 space-y-3">
        <input type="hidden" name="customerId" value={customer.id} />
        <h2 className="font-semibold">New Project</h2>
        <div className="grid grid-cols-2 gap-3">
          <input name="name" placeholder="Project name" required className="rounded border px-3 py-2" />
          <input name="customerProjectNumber" placeholder="Customer PO #" className="rounded border px-3 py-2" />
          <input name="siteAddress" placeholder="Site address" className="rounded border px-3 py-2 col-span-2" />
          <input name="endUse" placeholder="End use" className="rounded border px-3 py-2 col-span-2" />
          <input type="date" name="needByDate" className="rounded border px-3 py-2" />
        </div>
        <button className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm">Create project</button>
      </form>

      <div>
        <h2 className="font-semibold mb-2">Projects</h2>
        <ul className="space-y-2">
          {customer.projects.map((p) => (
            <li key={p.id} className="bg-white border rounded p-3">
              <Link href={`/projects/${p.id}`} className="font-medium">{p.name}</Link>
              <span className="text-sm text-gray-500 ml-2">{p.quotes.length} quote(s)</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Project detail + new-quote button**

Create `app/(app)/projects/[id]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { createQuote } from '@/lib/actions/quotes';

export default async function ProjectDetail({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as any;
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: { customer: true, quotes: { include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
  });
  if (!project || project.customer.tenantId !== user.tenantId) notFound();

  return (
    <div className="space-y-6">
      <div><Link href={`/customers/${project.customerId}`} className="text-sm text-blue-600">← {project.customer.name}</Link></div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <form action={createQuote}>
          <input type="hidden" name="projectId" value={project.id} />
          <button className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm">New quote</button>
        </form>
      </div>

      <p className="text-gray-600">{project.siteAddress}</p>

      <div>
        <h2 className="font-semibold mb-2">Quotes</h2>
        <ul className="space-y-2">
          {project.quotes.map((q) => (
            <li key={q.id} className="bg-white border rounded p-3 flex justify-between">
              <div>
                <div className="font-mono">{q.number}</div>
                <div className="text-sm text-gray-500">Rev {q.revisions[0]?.label ?? '—'} · {q.status}</div>
              </div>
              {q.revisions[0] && (
                <Link href={`/quotes/${q.id}/rev/${q.revisions[0].label}/step-1`} className="text-blue-600 text-sm self-center">Open</Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add 'app/(app)/customers/[id]' 'app/(app)/projects'
git commit -m "feat: customer and project detail pages with project/quote creation"
```

### Task H3: Wizard shell and Step 1

**Files:**
- Create: `components/wizard/WizardShell.tsx`, `app/(app)/quotes/[quoteId]/rev/[revLabel]/step-1/page.tsx`

- [ ] **Step 1: Create WizardShell**

```tsx
import Link from 'next/link';

const STEPS = [
  { n: 1, label: 'Customer & Project', path: 'step-1' },
  { n: 2, label: 'Service & Certifications', path: 'step-2' },
  { n: 3, label: 'Geometry', path: 'step-3' },
  { n: 4, label: 'Resin & Wall Buildup', path: 'step-4' },
  { n: 5, label: 'Review & Generate', path: 'review' },
];

export function WizardShell({
  quoteId,
  revLabel,
  current,
  children,
}: {
  quoteId: string;
  revLabel: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[220px_1fr_260px] gap-6">
      <nav className="space-y-1">
        {STEPS.map((s) => (
          <Link
            key={s.path}
            href={`/quotes/${quoteId}/rev/${revLabel}/${s.path}`}
            className={`block rounded px-3 py-2 text-sm ${
              current === s.path ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-xs text-gray-500 block">Step {s.n}</span>
            {s.label}
          </Link>
        ))}
      </nav>
      <div className="bg-white border rounded p-6">{children}</div>
      <aside className="bg-white border rounded p-4 text-sm">
        <div className="text-xs uppercase text-gray-500 mb-2">Live Summary</div>
        <div className="text-gray-500">Pricing engine arrives in Plan 3.</div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Step 1 page (Customer & Project recap)**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';

export default async function Step1({ params }: { params: { quoteId: string; revLabel: string } }) {
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId: params.quoteId, label: params.revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  return (
    <WizardShell quoteId={params.quoteId} revLabel={params.revLabel} current="step-1">
      <h2 className="text-xl font-semibold mb-4">Customer & Project</h2>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-gray-500">Customer</dt><dd>{rev.quote.project.customer.name}</dd></div>
        <div><dt className="text-gray-500">Project</dt><dd>{rev.quote.project.name}</dd></div>
        <div><dt className="text-gray-500">Site address</dt><dd>{rev.quote.project.siteAddress ?? '—'}</dd></div>
        <div><dt className="text-gray-500">End use</dt><dd>{rev.quote.project.endUse ?? '—'}</dd></div>
      </dl>
      <div className="mt-6 text-right">
        <Link href={`/quotes/${params.quoteId}/rev/${params.revLabel}/step-2`} className="rounded bg-blue-600 text-white px-4 py-2 text-sm">
          Next: Service & Certifications →
        </Link>
      </div>
    </WizardShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/wizard 'app/(app)/quotes/[quoteId]/rev/[revLabel]/step-1'
git commit -m "feat: wizard shell and Step 1 (Customer & Project recap)"
```

### Task H4: Step 2 — Service Conditions & Certifications form

**Files:**
- Create: `app/(app)/quotes/[quoteId]/rev/[revLabel]/step-2/page.tsx`

- [ ] **Step 1: Create form page**

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveServiceStep } from '@/lib/actions/revisions';
import { CHEMICAL_FAMILIES } from '@/lib/catalog/seed-data';

export default async function Step2({ params }: { params: { quoteId: string; revLabel: string } }) {
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId: params.quoteId, label: params.revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const s: any = rev.service ?? {};
  const c: any = rev.certs ?? {};
  const site: any = rev.site ?? {
    indoor: false,
    seismic: { siteClass: 'D', Ss: 1.0, S1: 0.35, Ie: 1.0, riskCategory: 'II' },
    wind: { V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
  };

  const save = saveServiceStep.bind(null, params.quoteId, params.revLabel);

  return (
    <WizardShell quoteId={params.quoteId} revLabel={params.revLabel} current="step-2">
      <h2 className="text-xl font-semibold mb-4">Service Conditions & Certifications</h2>
      <form action={save} className="space-y-6 text-sm">

        <section className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-gray-600">Chemical</span>
            <input name="chemical" defaultValue={s.chemical ?? ''} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Chemical family</span>
            <select name="chemicalFamily" defaultValue={s.chemicalFamily ?? 'dilute_acid'} className="w-full rounded border px-3 py-2">
              {CHEMICAL_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Concentration (%)</span>
            <input type="number" step="any" name="concentrationPct" defaultValue={s.concentrationPct ?? ''} className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Operating temp (°F)</span>
            <input type="number" step="any" name="operatingTempF" defaultValue={s.operatingTempF ?? 80} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Design temp (°F)</span>
            <input type="number" step="any" name="designTempF" defaultValue={s.designTempF ?? 120} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Specific gravity</span>
            <input type="number" step="any" name="specificGravity" defaultValue={s.specificGravity ?? 1.0} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Operating pressure (psig)</span>
            <input type="number" step="any" name="operatingPressurePsig" defaultValue={s.operatingPressurePsig ?? 0} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Vacuum (psig)</span>
            <input type="number" step="any" name="vacuumPsig" defaultValue={s.vacuumPsig ?? 0} required className="w-full rounded border px-3 py-2" />
          </label>
        </section>

        <section>
          <h3 className="font-semibold mb-2">Certifications</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-gray-600">ASME RTP-1 class</span>
              <select name="asmeRtp1Class" defaultValue={c.asmeRtp1Class ?? ''} className="w-full rounded border px-3 py-2">
                <option value="">None</option>
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-gray-600">RTP-1 std revision</span>
              <input name="asmeRtp1StdRevision" defaultValue={c.asmeRtp1StdRevision ?? 'RTP-1:2019'} className="w-full rounded border px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 col-span-2">
              <input type="checkbox" name="nsfAnsi61Required" defaultChecked={c.nsfAnsi61Required ?? false} />
              <span>NSF / ANSI 61 required</span>
            </label>
            <label className="space-y-1">
              <span className="text-gray-600">NSF 61 target end-use temp (°F)</span>
              <input type="number" step="any" name="nsfAnsi61TargetTempF" defaultValue={c.nsfAnsi61TargetTempF ?? ''} className="w-full rounded border px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 col-span-2">
              <input type="checkbox" name="nsfAnsi2Required" defaultChecked={c.nsfAnsi2Required ?? false} />
              <span>NSF / ANSI 2 required</span>
            </label>
            <label className="space-y-1 col-span-2">
              <span className="text-gray-600">Third-party inspector</span>
              <select name="thirdPartyInspector" defaultValue={c.thirdPartyInspector ?? 'NONE'} className="w-full rounded border px-3 py-2">
                <option value="NONE">None</option>
                <option value="TUV">TÜV</option>
                <option value="LLOYDS">Lloyd's</option>
                <option value="INTERTEK">Intertek</option>
              </select>
            </label>
          </div>
          <input type="hidden" name="ansiStandards" defaultValue={JSON.stringify(c.ansiStandards ?? [])} />
          <input type="hidden" name="requiredDocuments" defaultValue={JSON.stringify(c.requiredDocuments ?? [])} />
        </section>

        <section>
          <h3 className="font-semibold mb-2">Site & Environmental (pre-filled defaults; ASCE 7 auto-lookup in Plan 2)</h3>
          <input type="hidden" name="siteJson" defaultValue={JSON.stringify(site)} />
          <p className="text-xs text-gray-500">Seismic: Site Class D, Ss=1.0, S1=0.35. Wind: V=115 mph, Exposure C. Edit in Plan 2.</p>
        </section>

        <div className="text-right">
          <button className="rounded bg-blue-600 text-white px-4 py-2 text-sm">Save and continue →</button>
        </div>
      </form>
    </WizardShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'app/(app)/quotes/[quoteId]/rev/[revLabel]/step-2'
git commit -m "feat: Step 2 form for service conditions and certifications"
```

### Task H5: Step 3 — Geometry form

**Files:**
- Create: `app/(app)/quotes/[quoteId]/rev/[revLabel]/step-3/page.tsx`

- [ ] **Step 1: Create form**

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveGeometryStep } from '@/lib/actions/revisions';

export default async function Step3({ params }: { params: { quoteId: string; revLabel: string } }) {
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId: params.quoteId, label: params.revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const g: any = rev.geometry ?? {};
  const save = saveGeometryStep.bind(null, params.quoteId, params.revLabel);

  return (
    <WizardShell quoteId={params.quoteId} revLabel={params.revLabel} current="step-3">
      <h2 className="text-xl font-semibold mb-4">Geometry & Orientation</h2>
      <form action={save} className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-gray-600">Orientation</span>
            <select name="orientation" defaultValue={g.orientation ?? 'vertical'} className="w-full rounded border px-3 py-2">
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Inside Diameter (in)</span>
            <input type="number" step="any" name="idIn" defaultValue={g.idIn ?? 120} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Straight-side height (in)</span>
            <input type="number" step="any" name="ssHeightIn" defaultValue={g.ssHeightIn ?? 144} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Freeboard (in)</span>
            <input type="number" step="any" name="freeboardIn" defaultValue={g.freeboardIn ?? 12} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Top head</span>
            <select name="topHead" defaultValue={g.topHead ?? 'F_AND_D'} className="w-full rounded border px-3 py-2">
              <option value="flat">Flat</option>
              <option value="F_AND_D">Flanged & Dished</option>
              <option value="conical">Conical</option>
              <option value="open_top_cover">Open Top w/ Cover</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Bottom</span>
            <select name="bottom" defaultValue={g.bottom ?? 'flat_ring_supported'} className="w-full rounded border px-3 py-2">
              <option value="flat_ring_supported">Flat w/ support ring</option>
              <option value="dished">Dished</option>
              <option value="conical_drain">Conical drain</option>
              <option value="sloped">Sloped</option>
            </select>
          </label>
        </div>
        <div className="text-right">
          <button className="rounded bg-blue-600 text-white px-4 py-2 text-sm">Save and continue →</button>
        </div>
      </form>
    </WizardShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'app/(app)/quotes/[quoteId]/rev/[revLabel]/step-3'
git commit -m "feat: Step 3 geometry form"
```

### Task H6: Step 4 — Resin selection (rules-filtered)

**Files:**
- Create: `app/(app)/quotes/[quoteId]/rev/[revLabel]/step-4/page.tsx`

- [ ] **Step 1: Create resin selection page**

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveResinStep } from '@/lib/actions/revisions';
import { SEED_RESINS } from '@/lib/catalog/seed-data';
import { filterByChemistry } from '@/lib/rules/compatibility';
import { filterByCertifications } from '@/lib/rules/certification-filter';

export default async function Step4({ params }: { params: { quoteId: string; revLabel: string } }) {
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId: params.quoteId, label: params.revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const service: any = rev.service ?? {};
  const certs: any = rev.certs ?? {};

  const afterChem = filterByChemistry(SEED_RESINS, service.chemicalFamily, service.designTempF);
  const eligible = filterByCertifications(afterChem, {
    asme_rtp1_class: certs.asmeRtp1Class ?? null,
    ansi_standards: certs.ansiStandards ?? [],
    nsf_ansi_61_required: !!certs.nsfAnsi61Required,
    nsf_ansi_61_target_temp_F: certs.nsfAnsi61TargetTempF,
    nsf_ansi_2_required: !!certs.nsfAnsi2Required,
  }, service.designTempF);

  const w: any = rev.wallBuildup ?? {};
  const save = saveResinStep.bind(null, params.quoteId, params.revLabel);

  return (
    <WizardShell quoteId={params.quoteId} revLabel={params.revLabel} current="step-4">
      <h2 className="text-xl font-semibold mb-4">Resin & Wall Buildup</h2>

      {eligible.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <strong>No eligible resin.</strong> The chemistry + certification combination eliminated all candidates from the V1 catalog. This revision will be flagged for engineering review.
        </div>
      ) : (
        <form action={save} className="space-y-4 text-sm">
          <p className="text-gray-500">{eligible.length} of {SEED_RESINS.length} catalog resins pass chemistry + certification filters.</p>
          <div className="space-y-2">
            {eligible.map((r) => (
              <label key={r.id} className="flex items-start gap-3 border rounded p-3 cursor-pointer hover:bg-gray-50">
                <input type="radio" name="resinId" value={r.id} defaultChecked={w.resinId === r.id} required />
                <div>
                  <div className="font-medium">{r.name} <span className="text-gray-500 font-normal">({r.supplier})</span></div>
                  <div className="text-xs text-gray-500">
                    Family: {r.family} · Max service temp: {r.max_service_temp_F}°F · ${r.price_per_lb.toFixed(2)}/lb
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="text-right">
            <button className="rounded bg-blue-600 text-white px-4 py-2 text-sm">Continue to review →</button>
          </div>
        </form>
      )}
    </WizardShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'app/(app)/quotes/[quoteId]/rev/[revLabel]/step-4'
git commit -m "feat: Step 4 resin selection filtered by chemistry + certifications"
```

### Task H7: Review page + JSON download button

**Files:**
- Create: `app/(app)/quotes/[quoteId]/rev/[revLabel]/review/page.tsx`

- [ ] **Step 1: Create review page**

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { buildEngineeringJson } from '@/lib/outputs/engineering-json';
import { RULES_ENGINE_VERSION } from '@/lib/rules';

export default async function Review({ params }: { params: { quoteId: string; revLabel: string } }) {
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId: params.quoteId, label: params.revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const json = buildEngineeringJson(
    { quote: rev.quote, revision: rev } as any,
    { rulesEngineVersion: RULES_ENGINE_VERSION, catalogSnapshotId: 'seed-v0' },
  );

  return (
    <WizardShell quoteId={params.quoteId} revLabel={params.revLabel} current="review">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Review & Generate</h2>
        <a
          href={`/quotes/${params.quoteId}/rev/${params.revLabel}/engineering.json`}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm"
        >
          Download Engineering JSON
        </a>
      </div>

      <div className="space-y-4 text-sm">
        <section>
          <h3 className="font-semibold">Customer / Project</h3>
          <div className="text-gray-700">{json.customer.name} · {json.project.name} · {json.project.site_address ?? '—'}</div>
        </section>

        <section>
          <h3 className="font-semibold">Service</h3>
          <div className="text-gray-700">
            {json.service.chemical} ({json.service.chemical_family})
            · Op {json.service.operating_temp_F}°F / Design {json.service.design_temp_F}°F
            · SG {json.service.specific_gravity}
          </div>
        </section>

        <section>
          <h3 className="font-semibold">Certifications</h3>
          <div className="text-gray-700">
            {json.certifications.asme_rtp1 ? `ASME RTP-1 Class ${json.certifications.asme_rtp1.class}` : 'No ASME RTP-1'}
            {' · '}
            {json.certifications.nsf_ansi_61.required ? 'NSF/ANSI 61' : '—'}
            {' · '}
            {json.certifications.nsf_ansi_2.required ? 'NSF/ANSI 2' : '—'}
          </div>
        </section>

        <section>
          <h3 className="font-semibold">Geometry</h3>
          <div className="text-gray-700">
            {json.geometry.orientation} · {json.geometry.id_in}" ID × {json.geometry.ss_height_in}" SS ·
            top {json.geometry.top_head} · bottom {json.geometry.bottom}
          </div>
        </section>

        <section>
          <h3 className="font-semibold">Resin</h3>
          <div className="text-gray-700">{json.wall_buildup.corrosion_barrier.resin ?? 'None selected'}</div>
        </section>

        <section>
          <h3 className="font-semibold">JSON Preview</h3>
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-[400px]">
{JSON.stringify(json, null, 2)}
          </pre>
        </section>
      </div>
    </WizardShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'app/(app)/quotes/[quoteId]/rev/[revLabel]/review'
git commit -m "feat: review page with engineering JSON preview and download"
```

---

## Phase I — End-to-End Validation

### Task I1: Playwright smoke test for the full walking-skeleton flow

**Files:**
- Create: `tests/e2e/walking-skeleton.spec.ts`

- [ ] **Step 1: Write the e2e test**

This test assumes a logged-in session via a test-mode auth bypass. Add a dev-only route `app/api/test/login/route.ts` guarded by `NODE_ENV !== 'production'`:

Create `app/api/test/login/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encode } from 'next-auth/jwt';

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') return new NextResponse('forbidden', { status: 403 });
  const { email } = await req.json();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return new NextResponse('no user', { status: 404 });

  const session = await db.session.create({
    data: {
      sessionToken: crypto.randomUUID(),
      userId: user.id,
      expires: new Date(Date.now() + 3600_000),
    },
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('authjs.session-token', session.sessionToken, {
    httpOnly: true,
    path: '/',
    expires: session.expires,
  });
  return res;
}
```

Create `tests/e2e/walking-skeleton.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('sales rep creates customer → project → quote → fills wizard → downloads JSON', async ({ page, request }) => {
  // Log in as seeded admin
  await request.post('/api/test/login', { data: { email: 'admin@frp-tank-quoter.local' } });

  // Create customer
  await page.goto('/customers');
  await page.fill('input[name=name]', 'Acme Chem Co.');
  await page.fill('input[name=contactName]', 'Jane Doe');
  await page.fill('input[name=contactEmail]', 'jane@acme.test');
  await page.click('button:has-text("Create")');
  await expect(page.locator('h1')).toContainText('Acme Chem Co.');

  // Create project
  await page.fill('input[name=name]', 'Main sulfuric storage');
  await page.fill('input[name=siteAddress]', '123 Industrial Pkwy, Fairfield OH');
  await page.fill('input[name=endUse]', '50% sulfuric storage');
  await page.click('button:has-text("Create project")');
  await expect(page.locator('h1')).toContainText('Main sulfuric storage');

  // Create quote
  await page.click('button:has-text("New quote")');
  await expect(page).toHaveURL(/\/step-1$/);

  // Step 1 continue
  await page.click('a:has-text("Next")');

  // Step 2 fill
  await page.fill('input[name=chemical]', 'H2SO4');
  await page.selectOption('select[name=chemicalFamily]', 'dilute_acid');
  await page.fill('input[name=concentrationPct]', '50');
  await page.fill('input[name=operatingTempF]', '120');
  await page.fill('input[name=designTempF]', '140');
  await page.fill('input[name=specificGravity]', '1.4');
  await page.fill('input[name=operatingPressurePsig]', '0');
  await page.fill('input[name=vacuumPsig]', '0');
  await page.selectOption('select[name=asmeRtp1Class]', 'II');
  await page.click('button:has-text("Save and continue")');

  // Step 3 geometry (use defaults)
  await page.click('button:has-text("Save and continue")');

  // Step 4 resin
  await page.click('input[name=resinId]');
  await page.click('button:has-text("Continue to review")');

  // Review page
  await expect(page.locator('h2')).toContainText('Review & Generate');
  await expect(page.locator('pre')).toContainText('"schema_version": "1.0.0"');

  // JSON endpoint returns valid JSON with quote number
  const res = await page.request.get(page.url().replace('/review', '/engineering.json'));
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.schema_version).toBe('1.0.0');
  expect(json.service.chemical).toBe('H2SO4');
  expect(json.certifications.asme_rtp1.class).toBe('II');
  expect(json.wall_buildup.corrosion_barrier.resin).toBeTruthy();
});
```

- [ ] **Step 2: Run e2e**

```bash
pnpm db:reset && pnpm db:seed && pnpm test:e2e
```

Expected: test passes.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e app/api/test
git commit -m "test: e2e walking-skeleton flow from sign-in to JSON download"
```

---

## Phase J — Deploy

### Task J1: README with local dev instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write README**

```markdown
# FRP Tank Quoter

SaaS quoting tool for fiberglass reinforced plastic (FRP) chemical-storage tanks.

See `docs/superpowers/specs/2026-04-20-frp-tank-quoter-design.md` for the V1 design.

## Local development

Prereqs: Node 20+, pnpm, Postgres 16 (or Docker).

```bash
docker run -d --name frp-pg -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=user -e POSTGRES_DB=frp_tank_quoter -p 5432:5432 postgres:16
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000, enter the seeded email (`admin@frp-tank-quoter.local`), receive the magic link via your configured SMTP (Mailtrap in dev), click through to sign in.

## Tests

- `pnpm test` — unit tests (Vitest)
- `pnpm test:e2e` — end-to-end (Playwright)

## Deploy

Vercel + Neon Postgres. Set `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_SERVER`, `EMAIL_FROM` in Vercel env vars. Run `pnpm db:migrate` against the Neon branch before first deploy; then Vercel auto-deploys on push to `main`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with local dev and deploy instructions"
```

### Task J2: Vercel deploy

**Files:** none (Vercel CLI)

- [ ] **Step 1: Create Neon project and capture DATABASE_URL**

Log in to neon.tech → create project `frp-tank-quoter` → copy the pooled connection string.

- [ ] **Step 2: Link and deploy via Vercel CLI**

```bash
pnpm dlx vercel link
pnpm dlx vercel env add DATABASE_URL production
pnpm dlx vercel env add NEXTAUTH_URL production
pnpm dlx vercel env add NEXTAUTH_SECRET production
pnpm dlx vercel env add EMAIL_SERVER production
pnpm dlx vercel env add EMAIL_FROM production
pnpm dlx vercel --prod
```

Expected: production URL printed.

- [ ] **Step 3: Run migration against production Neon**

```bash
DATABASE_URL="<neon-prod-url>" pnpm prisma migrate deploy
DATABASE_URL="<neon-prod-url>" SEED_ADMIN_EMAIL="<your-email>" pnpm db:seed
```

- [ ] **Step 4: Smoke-test the deployed URL**

Visit the Vercel URL, sign in with the seeded email, run through the wizard, download the Engineering JSON. Confirm it matches the schema seen in local e2e.

- [ ] **Step 5: Commit any config files Vercel wrote**

```bash
git add .vercel vercel.json 2>/dev/null || true
git commit -m "chore: Vercel project linked" --allow-empty
```

---

## Completion Criteria

Plan 1 is done when all of the following hold:

- [ ] Seeded admin can sign in via magic link on the deployed URL
- [ ] They can create a customer, project, and quote
- [ ] They can fill Steps 1–4 and reach the Review page
- [ ] Resin dropdown is filtered by chemistry + certification combination (NSF/ANSI 61, RTP-1 class)
- [ ] `Download Engineering JSON` returns schema v1.0.0 with all populated blocks
- [ ] All unit tests pass (`pnpm test`)
- [ ] E2E test passes (`pnpm test:e2e`)
- [ ] AuditLog records one row per wizard save step
- [ ] AuditLog append-only enforcement rejects UPDATE/DELETE from the app DB role

A pilot user can now be pointed at the deployed URL and asked: "Does this capture what you'd need to quote a tank?" Their feedback drives Plan 2 scope.

---

## Self-Review Notes

- **Spec coverage:** Walking skeleton intentionally ships a subset. §4 data model → core entities present; Catalog, PriceFeed, PriceUpdate, NozzleSchedule, Accessories, PricingSnapshot deferred. §5 wizard → 4 of 7 steps. §6 rules → stubs only (real ASCE 7 / ASTM math in Plan 2). §8 outputs → only engineering JSON, no PDFs. §9 price feed → not started. §10 ISO 9001 → audit log + append-only enforcement + catalog_snapshot_id stamp. §11 roles → enum + helpers (full enforcement in Plan 6).
- **Placeholders:** None — every step has code.
- **Type consistency:** `SeedResin`, `CertificationRequirements`, wizard step paths, server-action signatures verified against shared modules.
- **Known simplification:** Site/seismic/wind fields use hard-coded defaults in the Step 2 form (stored in a hidden JSON input). Full address-driven lookup UI arrives in Plan 2.
- **Scope check:** ~20 tasks, each 2–5 steps, estimated 2–3 days of focused work. Fits one execution session.
