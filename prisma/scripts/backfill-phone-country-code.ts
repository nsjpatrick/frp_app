/**
 * One-shot: re-canonicalize every Customer.contactPhone (and each contact in
 * the JSON `contacts` roster) so that mock + user-entered rows share the
 * `+<CC>-<local>` form the app now expects everywhere.
 *
 * Idempotent — running twice produces the same output. Safe to re-run after
 * a reseed or after hand-editing rows in the DB.
 */
import { PrismaClient } from '@prisma/client';
import { normalizePhone } from '../../lib/phone';

const db = new PrismaClient();

// Seeded customers use deterministic ids `mock-cust-NN`. The original seed
// ran with 7-digit stubs; the current seed emits 10-digit numbers. Keep the
// generator in sync with prisma/seed.ts so re-running after a reseed is a
// no-op.
function seedMockPhone(id: string): string | null {
  const m = id.match(/^mock-cust-(\d+)$/);
  if (!m) return null;
  const i = Number(m[1]);
  return `+1-555-${String(100 + i).padStart(3, '0')}-${String(4000 + i * 13).padStart(4, '0')}`;
}

async function main() {
  const customers = await db.customer.findMany({
    select: { id: true, contactPhone: true, contacts: true },
  });

  let primaryUpdates = 0;
  let contactsUpdates = 0;

  for (const c of customers) {
    // Mock rows get the canonical seed pattern (area code included) so the
    // customers table shows full +1-555-XXX-XXXX numbers. Real rows just
    // get canonicalized through normalizePhone.
    const mockForm = seedMockPhone(c.id);
    const nextPrimary = mockForm ?? normalizePhone(c.contactPhone);
    const primaryChanged = nextPrimary !== (c.contactPhone ?? '');

    let nextContactsJson = c.contacts;
    let contactsChanged = false;
    if (Array.isArray(c.contacts)) {
      const next = (c.contacts as any[]).map((row, idx) => {
        const current = typeof row?.phone === 'string' ? row.phone : '';
        // First row mirrors the primary number; others just canonicalize.
        const canon = idx === 0 && mockForm
          ? mockForm
          : normalizePhone(current);
        if (canon !== current) contactsChanged = true;
        return { ...row, phone: canon };
      });
      if (contactsChanged) nextContactsJson = next as any;
    }

    if (!primaryChanged && !contactsChanged) continue;

    await db.customer.update({
      where: { id: c.id },
      data: {
        ...(primaryChanged ? { contactPhone: nextPrimary || null } : {}),
        ...(contactsChanged ? { contacts: nextContactsJson as any } : {}),
      },
    });

    if (primaryChanged) primaryUpdates++;
    if (contactsChanged) contactsUpdates++;
  }

  console.log(`Backfill done — primary: ${primaryUpdates}, contacts[]: ${contactsUpdates}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
