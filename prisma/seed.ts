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
