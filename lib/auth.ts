import NextAuth from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter, AdapterUser } from '@auth/core/adapters';
import { db } from '@/lib/db';
import type { Role } from '@prisma/client';

// Wrap PrismaAdapter to handle required tenantId on createUser.
// When NextAuth creates a new user via magic-link, we assign them to the
// mock tenant so the DB constraint is satisfied.
const FALLBACK_TENANT_ID = 'mock-plas-tanks';

function buildAdapter(): Adapter {
  const base = PrismaAdapter(db) as Adapter;
  return {
    ...base,
    // Override createUser to inject the fallback tenantId required by our schema.
    // NextAuth's default adapter passes only the Auth.js AdapterUser fields (no tenantId).
    createUser: async (user: AdapterUser): Promise<AdapterUser> => {
      // Ensure the fallback tenant exists before creating the user
      await db.tenant.upsert({
        where: { id: FALLBACK_TENANT_ID },
        update: {},
        create: { id: FALLBACK_TENANT_ID, name: 'Plas-Tanks Industries (mock)' },
      });
      const created = await db.user.create({
        data: {
          email: user.email,
          name: user.name,
          tenantId: (user as AdapterUser & { tenantId?: string }).tenantId ?? FALLBACK_TENANT_ID,
        },
      });
      return { ...created, emailVerified: null } as AdapterUser;
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: buildAdapter(),
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
