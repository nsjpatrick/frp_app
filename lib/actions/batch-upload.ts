'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { composePhone } from '@/lib/phone';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { revalidatePath } from 'next/cache';

const rowSchema = z.object({
  company: z.string().min(1),
  name:    z.string().min(1),
  email:   z.string().max(200).default(''),
  phone:   z.string().max(60).default(''),
  dial:    z.string().max(4).default('1'),
});

const payloadSchema = z.object({
  rows: z.array(rowSchema).min(1).max(5000),
});

export type BatchUploadResult = {
  customersCreated: number;
  customersMatched: number;
  contactsAppended: number;
  skipped: number;
};

/**
 * Batch-import contacts from a parsed spreadsheet. Each row carries a
 * company name; existing customers are matched case-insensitively within
 * the tenant, new ones are created with the row's contact as primary.
 *
 * Tenant-scoped throughout — lookups filter on `tenantId` so two tenants
 * can have a company with the same name without colliding.
 */
export async function batchUploadContacts(formData: FormData): Promise<BatchUploadResult> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) throw new Error('unauthenticated');

  const raw = String(formData.get('rowsJson') ?? '');
  let parsed: z.infer<typeof payloadSchema>;
  try {
    parsed = payloadSchema.parse({ rows: JSON.parse(raw || '[]') });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'invalid payload');
  }

  // Pre-load every customer in the tenant keyed by normalized name so
  // we only hit the DB once per row at most.
  const existing = await db.customer.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true, name: true, contacts: true, contactName: true, contactEmail: true, contactPhone: true },
  });
  const byKey = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]));

  let customersCreated = 0;
  let customersMatched = 0;
  let contactsAppended = 0;
  let skipped = 0;

  for (const row of parsed.rows) {
    const key = row.company.trim().toLowerCase();
    const phone = row.phone ? composePhone(row.dial || '1', row.phone) : '';
    const contact = { name: row.name, email: row.email, phone };

    const hit = byKey.get(key);

    if (!hit) {
      const created = await db.customer.create({
        data: {
          tenantId: user.tenantId,
          name: row.company.trim(),
          contactName: row.name,
          contactEmail: row.email || null,
          contactPhone: phone || null,
          contacts: [contact] as unknown as object,
        },
        select: { id: true, name: true, contacts: true, contactName: true, contactEmail: true, contactPhone: true },
      });
      byKey.set(key, created);
      customersCreated++;
      contactsAppended++;
      continue;
    }

    // Dedupe: skip if this customer already has a contact with the same
    // normalized email OR (name + phone) combination. Avoids re-running
    // the same import creating N copies of everyone.
    const currentContacts: Array<{ name: string; email: string; phone: string }> = Array.isArray(hit.contacts)
      ? (hit.contacts as unknown as Array<{ name: string; email: string; phone: string }>)
      : hit.contactName
        ? [{ name: hit.contactName, email: hit.contactEmail ?? '', phone: hit.contactPhone ?? '' }]
        : [];

    const emailLc = contact.email.toLowerCase();
    const dup = currentContacts.some((c) =>
      (emailLc && (c.email ?? '').toLowerCase() === emailLc) ||
      ((c.name ?? '').trim().toLowerCase() === contact.name.trim().toLowerCase() &&
        (c.phone ?? '') === contact.phone)
    );
    if (dup) {
      skipped++;
      continue;
    }

    const next = [...currentContacts, contact];
    await db.customer.update({
      where: { id: hit.id },
      data: { contacts: next as unknown as object },
    });
    // Keep our in-memory index in sync so later rows for the same company
    // see the appended contact when deduping.
    hit.contacts = next as any;
    customersMatched++;
    contactsAppended++;
  }

  await writeAuditEntry(db, {
    entityType: 'Customer',
    entityId: 'batch',
    actorUserId: user.id,
    action: 'batch:import-contacts',
    diffJson: { customersCreated, customersMatched, contactsAppended, skipped, total: parsed.rows.length },
  });

  revalidatePath('/customers');

  return { customersCreated, customersMatched, contactsAppended, skipped };
}
