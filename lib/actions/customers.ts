'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { customerCreateSchema, contactSchema, type Contact } from '@/lib/validators/entities';
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

  // Contacts come through as a JSON-serialized hidden field from the modal's
  // expandable contact rows. Fall back to single-contact fields if present
  // (backward compat for any callers still wiring the old shape).
  let contactsRaw: unknown[] = [];
  try {
    const json = String(formData.get('contactsJson') ?? '');
    contactsRaw = json ? JSON.parse(json) : [];
  } catch {
    contactsRaw = [];
  }
  if (contactsRaw.length === 0) {
    const name = formData.get('contactName');
    if (name) {
      contactsRaw = [{
        name: String(name),
        email: String(formData.get('contactEmail') ?? ''),
        phone: String(formData.get('contactPhone') ?? ''),
      }];
    }
  }

  const parsed = customerCreateSchema.parse({
    name: formData.get('name'),
    contacts: contactsRaw,
  });

  const primary = parsed.contacts[0];
  const customer = await db.customer.create({
    data: {
      tenantId: user.tenantId,
      name: parsed.name,
      // Denormalize the first contact onto the primary columns so existing
      // listings + mailto links keep working without schema gymnastics.
      contactName: primary.name,
      contactEmail: primary.email || null,
      contactPhone: primary.phone || null,
      contacts: parsed.contacts as unknown as object,
    },
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

/**
 * Append one or more new contacts to an existing customer's contacts array.
 * Validates tenant ownership before writing (same pattern we enforce on
 * every FK-based server action). Audit-logged as `add:contacts`.
 */
export async function addContactsToCustomer(formData: FormData) {
  const user = await getSessionUser();
  const customerId = String(formData.get('customerId') ?? '');

  let rawContacts: unknown[] = [];
  try {
    const json = String(formData.get('contactsJson') ?? '');
    rawContacts = json ? JSON.parse(json) : [];
  } catch {
    rawContacts = [];
  }
  const newContacts = z.array(contactSchema).min(1).parse(rawContacts);

  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.tenantId !== user.tenantId) {
    throw new Error('customer not found');
  }

  // Existing contacts — prefer JSON field, fall back to legacy single-contact
  // columns so customers seeded before the JSON column was added still grow
  // their contact roster cleanly.
  const existing: Contact[] = Array.isArray((customer as any).contacts)
    ? ((customer as any).contacts as Contact[])
    : customer.contactName
      ? [{
          name: customer.contactName,
          email: customer.contactEmail ?? '',
          phone: customer.contactPhone ?? '',
        }]
      : [];

  const merged = [...existing, ...newContacts];

  await db.customer.update({
    where: { id: customerId },
    data: { contacts: merged as unknown as object },
  });

  await writeAuditEntry(db, {
    entityType: 'Customer',
    entityId: customerId,
    actorUserId: user.id,
    action: 'add:contacts',
    diffJson: { added: newContacts },
  });

  revalidatePath(`/customers/${customerId}`);
}
