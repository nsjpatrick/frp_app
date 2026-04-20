import { db } from '@/lib/db';
import type { Role } from '@prisma/client';

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
        name: 'Dev Admin',
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

export const signIn = async () => {
  /* no-op — auth is stubbed */
};

export const signOut = async () => {
  /* no-op — auth is stubbed */
};

export const handlers = {
  GET: () => new Response('Auth disabled', { status: 501 }),
  POST: () => new Response('Auth disabled', { status: 501 }),
};

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  tenantId: string;
};
