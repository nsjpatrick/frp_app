'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { customerCreateSchema, customerUpdateSchema, contactSchema, type Contact } from '@/lib/validators/entities';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { normalizePhone } from '@/lib/format';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Phones come off forms in whatever shape a rep typed — `(555) 123.4567`,
// `5551234567`, `+1-555-123-4567`. We canonicalize on the way in so the
// DB (and every downstream read) is consistent.
function normalizeContacts(list: Contact[]): Contact[] {
  return list.map((c) => ({ ...c, phone: normalizePhone(c.phone) }));
}

async function getSessionUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user as { id: string; tenantId: string; role: 'SALES' | 'ENGINEER' | 'ADMIN' };
}

function parseCustomerForm(formData: FormData) {
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
  return customerCreateSchema.parse({
    name: formData.get('name'),
    contacts: contactsRaw,
  });
}

export async function createCustomer(formData: FormData) {
  const user = await getSessionUser();
  const parsed = parseCustomerForm(formData);
  const contacts = normalizeContacts(parsed.contacts);

  const primary = contacts[0];
  const customer = await db.customer.create({
    data: {
      tenantId: user.tenantId,
      name: parsed.name,
      // Denormalize the first contact onto the primary columns so existing
      // listings + mailto links keep working without schema gymnastics.
      contactName: primary.name,
      contactEmail: primary.email || null,
      contactPhone: primary.phone || null,
      contacts: contacts as unknown as object,
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

/**
 * Create a customer and immediately start a quote for them (projectless),
 * redirecting to the wizard. Used by the new-quote page's inline
 * "New Customer" modal so the rep doesn't have to visit /customers first.
 */
export async function createCustomerAndQuote(formData: FormData) {
  const user = await getSessionUser();
  const parsed = parseCustomerForm(formData);
  const contacts = normalizeContacts(parsed.contacts);
  const primary = contacts[0];

  const customer = await db.customer.create({
    data: {
      tenantId: user.tenantId,
      name: parsed.name,
      contactName: primary.name,
      contactEmail: primary.email || null,
      contactPhone: primary.phone || null,
      contacts: contacts as unknown as object,
    },
  });

  await writeAuditEntry(db, {
    entityType: 'Customer',
    entityId: customer.id,
    actorUserId: user.id,
    action: 'create',
    diffJson: parsed,
  });

  const y = new Date().getFullYear();
  const quote = await db.quote.create({
    data: {
      customerId: customer.id,
      number: `Q-${y}-${Math.floor(Math.random() * 9000) + 1000}`,
    },
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
    diffJson: { number: quote.number, customerId: customer.id, via: 'new-customer-modal' },
  });

  revalidatePath('/customers');
  redirect(`/quotes/${quote.id}/rev/${rev.label}/step-1`);
}

export async function listCustomers() {
  const user = await getSessionUser();
  return db.customer.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      projects: { select: { id: true, name: true } },
      _count: { select: { quotes: true } },
    },
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
  const newContacts = normalizeContacts(
    z.array(contactSchema).min(1).parse(rawContacts),
  );

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

/**
 * Edit a customer's company name + contact roster. Replaces the full
 * contacts array with the submitted one, so the caller is expected to
 * send the complete set (not a diff).
 */
export async function updateCustomer(formData: FormData) {
  const user = await getSessionUser();

  let contactsRaw: unknown[] = [];
  try {
    const json = String(formData.get('contactsJson') ?? '');
    contactsRaw = json ? JSON.parse(json) : [];
  } catch {
    contactsRaw = [];
  }

  const parsed = customerUpdateSchema.parse({
    customerId: formData.get('customerId'),
    name: formData.get('name'),
    contacts: contactsRaw,
  });
  const contacts = normalizeContacts(parsed.contacts);

  const existing = await db.customer.findUnique({ where: { id: parsed.customerId } });
  if (!existing || existing.tenantId !== user.tenantId) {
    throw new Error('customer not found');
  }

  const primary = contacts[0];
  await db.customer.update({
    where: { id: parsed.customerId },
    data: {
      name: parsed.name.trim(),
      contactName: primary.name,
      contactEmail: primary.email || null,
      contactPhone: primary.phone || null,
      contacts: contacts as unknown as object,
    },
  });

  await writeAuditEntry(db, {
    entityType: 'Customer',
    entityId: parsed.customerId,
    actorUserId: user.id,
    action: 'update',
    diffJson: { name: parsed.name, contacts },
  });

  revalidatePath('/customers');
  revalidatePath(`/customers/${parsed.customerId}`);
}

/**
 * Delete a customer and everything underneath — projects, quotes,
 * revisions, audit entries tied to quotes. Tenant-scoped every step.
 * Wrapped in a transaction so a partial failure rolls back.
 *
 * Demo-friendly default: cascade. In a prod app we'd probably gate this
 * behind a confirmation token or split into hard/soft delete.
 */
export async function deleteCustomer(formData: FormData) {
  const user = await getSessionUser();
  const customerId = String(formData.get('customerId') ?? '');

  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      _count: { select: { projects: true, quotes: true } },
    },
  });
  if (!customer || customer.tenantId !== user.tenantId) {
    throw new Error('customer not found');
  }

  await db.$transaction(async (tx) => {
    // Delete revisions, then quotes, then projects, then the customer. Direct
    // order matters because FK constraints are RESTRICT by default.
    const quotes = await tx.quote.findMany({
      where: { customerId },
      select: { id: true },
    });
    const quoteIds = quotes.map((q) => q.id);
    if (quoteIds.length > 0) {
      await tx.revision.deleteMany({ where: { quoteId: { in: quoteIds } } });
      await tx.quote.deleteMany({ where: { id: { in: quoteIds } } });
    }
    await tx.project.deleteMany({ where: { customerId } });
    await tx.customer.delete({ where: { id: customerId } });
  });

  await writeAuditEntry(db, {
    entityType: 'Customer',
    entityId: customerId,
    actorUserId: user.id,
    action: 'delete',
    diffJson: {
      name: customer.name,
      cascadedProjects: customer._count.projects,
      cascadedQuotes: customer._count.quotes,
    },
  });

  revalidatePath('/customers');
}
