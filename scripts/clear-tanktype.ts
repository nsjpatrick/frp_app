// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client') as typeof import('@prisma/client');
const db = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) { console.error('usage: clear-tanktype.ts <quoteId>'); process.exit(1); }
  const rev = await db.revision.findFirst({ where: { quoteId: id, label: 'A' } });
  if (!rev) { console.error('rev not found'); process.exit(1); }
  const service: any = rev.service ?? {};
  delete service.tankType;
  await db.revision.update({ where: { id: rev.id }, data: { service } });
  console.log('cleared tankType for', rev.id, '— now:', service);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
