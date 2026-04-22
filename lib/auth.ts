import { db } from '@/lib/db';
import type { Role } from '@prisma/client';

/**
 * Demo-mode auth.
 *
 * There is no real authentication in this build. Every request is served
 * as the seeded demo admin (`dev@frp-tank-quoter.local`) so the deployed
 * URL can be shared with reviewers without SMTP / OAuth / password setup.
 *
 * Replace this module with a real provider (NextAuth, Clerk, custom) before
 * exposing real customer data.
 */

const DEV_TENANT_ID = 'mock-plas-tanks';
const DEV_USER_EMAIL = 'dev@frp-tank-quoter.local';

async function ensureDevUser() {
  const existing = await db.user.findUnique({ where: { email: DEV_USER_EMAIL } });
  if (existing) return existing;

  await db.tenant.upsert({
    where: { id: DEV_TENANT_ID },
    update: {},
    create: { id: DEV_TENANT_ID, name: 'Plas-Tanks Industries (mock)' },
  });
  try {
    return await db.user.create({
      data: {
        email: DEV_USER_EMAIL,
        name: 'Demo Admin',
        role: 'ADMIN',
        tenantId: DEV_TENANT_ID,
      },
    });
  } catch {
    return db.user.findUniqueOrThrow({ where: { email: DEV_USER_EMAIL } });
  }
}

export async function auth() {
  const user = await ensureDevUser();
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    },
  };
}

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  tenantId: string;
};
