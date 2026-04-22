/**
 * One-shot: ensure January and March of the current year each have a few
 * mock WON quotes so the dashboard revenue chart shows bars in those
 * months. Idempotent — re-runs re-upsert with fixed quote numbers.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function ensureWin(opts: {
  number: string;
  customerId: string;
  wonAt: Date;
  totalPrice: number;
}) {
  // Upsert by the (unique) quote number. Revision A is created once on
  // first insert and left alone on subsequent runs.
  const existing = await db.quote.findUnique({ where: { number: opts.number } });
  if (existing) {
    await db.quote.update({
      where: { number: opts.number },
      data: {
        status: 'WON',
        wonAt: opts.wonAt,
        totalPrice: opts.totalPrice,
        updatedAt: opts.wonAt,
      },
    });
    return;
  }
  const created = await db.quote.create({
    data: {
      number: opts.number,
      customerId: opts.customerId,
      status: 'WON',
      wonAt: opts.wonAt,
      totalPrice: opts.totalPrice,
      createdAt: new Date(opts.wonAt.getTime() - 21 * 86400 * 1000),
      updatedAt: opts.wonAt,
    },
  });
  await db.revision.create({
    data: { quoteId: created.id, label: 'A', createdAt: created.createdAt },
  });
}

async function main() {
  const year = new Date().getFullYear();

  // Spread across a few mock customers so the Recent Quotes list + customer
  // detail cards don't all light up the same row.
  const spec = [
    { number: `Q-${year}-MOCK-JAN-01`, customerId: 'mock-cust-00', wonAt: new Date(year, 0, 12), totalPrice: 78_500 },
    { number: `Q-${year}-MOCK-JAN-02`, customerId: 'mock-cust-03', wonAt: new Date(year, 0, 24), totalPrice: 142_300 },
    { number: `Q-${year}-MOCK-MAR-01`, customerId: 'mock-cust-06', wonAt: new Date(year, 2, 8),  totalPrice: 96_200 },
    { number: `Q-${year}-MOCK-MAR-02`, customerId: 'mock-cust-09', wonAt: new Date(year, 2, 21), totalPrice: 187_400 },
  ];

  for (const s of spec) {
    await ensureWin(s);
  }

  console.log(`Seeded / refreshed ${spec.length} Jan+Mar ${year} mock wins.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
