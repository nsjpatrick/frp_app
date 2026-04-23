'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { computePricing } from '@/lib/pricing/pricing-engine';
import { revalidatePath } from 'next/cache';

async function getUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user;
}

/**
 * Update the Customer + Project info attached to a quote from the final
 * recipient-confirmation step. Tenant-checked before every write. No
 * redirect — the client fires the mailto link after this resolves, so we
 * stay on the page.
 *
 * Project-linkage modes:
 *   - `keep`   → leave the quote's current project attachment alone
 *   - `attach` → switch the quote to an existing project (projectId)
 *   - `create` → create a brand-new project and attach the quote to it
 *   - `detach` → remove any project link (projectless quote)
 *
 * Company address columns are optional; blank fields clear the column
 * so the rep can drop stale data without a migration.
 */
export async function saveRecipientForQuote(formData: FormData): Promise<void> {
  const user = await getUser();
  const customerId = String(formData.get('customerId') ?? '');
  const quoteId    = String(formData.get('quoteId') ?? '');

  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.tenantId !== user.tenantId) {
    throw new Error('customer not found');
  }
  const quote = await db.quote.findUnique({ where: { id: quoteId } });
  if (!quote || quote.customerId !== customerId) {
    throw new Error('quote not found');
  }

  // ── Primary contact ───────────────────────────────────────────────────
  const contactName  = String(formData.get('contactName') ?? '').trim() || null;
  const contactEmail = String(formData.get('contactEmail') ?? '').trim() || null;
  const contactPhoneRaw = String(formData.get('contactPhone') ?? '').trim();
  const contactPhone = contactPhoneRaw ? normalizePhone(contactPhoneRaw) : null;

  // ── Company address (optional) ────────────────────────────────────────
  const cleanStr = (k: string): string | null => {
    const v = String(formData.get(k) ?? '').trim();
    return v ? v : null;
  };
  const addressLine1 = cleanStr('addressLine1');
  const addressLine2 = cleanStr('addressLine2');
  const city         = cleanStr('city');
  const region       = cleanStr('region');
  const postalCode   = cleanStr('postalCode');
  const country      = cleanStr('country');

  await db.customer.update({
    where: { id: customerId },
    data: {
      contactName, contactEmail, contactPhone,
      addressLine1, addressLine2, city, region, postalCode, country,
    },
  });

  await writeAuditEntry(db, {
    entityType: 'Customer',
    entityId: customerId,
    actorUserId: user.id,
    action: 'update:contact+address',
    diffJson: {
      contactName, contactEmail, contactPhone,
      addressLine1, addressLine2, city, region, postalCode, country,
      via: 'send-step',
    },
  });

  // ── Project linkage ───────────────────────────────────────────────────
  const mode = String(formData.get('projectMode') ?? 'keep') as
    | 'keep' | 'attach' | 'create' | 'detach';

  let activeProjectId: string | null = quote.projectId;

  if (mode === 'attach') {
    const target = String(formData.get('projectId') ?? '').trim();
    if (!target) throw new Error('project id required for attach');
    const project = await db.project.findUnique({ where: { id: target } });
    if (!project || project.customerId !== customerId) {
      throw new Error('project not found for this customer');
    }
    activeProjectId = project.id;
  } else if (mode === 'create') {
    const name = String(formData.get('newProjectName') ?? '').trim();
    if (!name) throw new Error('new project name required');
    const siteAddress = String(formData.get('newProjectSite') ?? '').trim() || null;
    const description = String(formData.get('newProjectDescription') ?? '').trim() || null;
    const created = await db.project.create({
      data: { customerId, name, siteAddress, description },
    });
    await writeAuditEntry(db, {
      entityType: 'Project',
      entityId: created.id,
      actorUserId: user.id,
      action: 'create',
      diffJson: { name, siteAddress, description, via: 'send-step' },
    });
    activeProjectId = created.id;
  } else if (mode === 'detach') {
    activeProjectId = null;
  }

  // Persist the linkage change on the quote itself.
  if (activeProjectId !== quote.projectId) {
    await db.quote.update({
      where: { id: quoteId },
      data: { projectId: activeProjectId },
    });
    await writeAuditEntry(db, {
      entityType: 'Quote',
      entityId: quoteId,
      actorUserId: user.id,
      action: 'update:project-linkage',
      diffJson: { previousProjectId: quote.projectId, newProjectId: activeProjectId },
    });
  }

  // Recompute + persist the quote's total price. Sending is the canonical
  // moment the rep commits to a number, so we snapshot it on the Quote
  // row — dashboards, the quotes list, and the detail page all read it.
  // Uses the latest revision so the stored value matches what the PDF
  // just rendered.
  const latestRev = await db.revision.findFirst({
    where: { quoteId },
    orderBy: { createdAt: 'desc' },
  });
  if (latestRev) {
    const pricing = computePricing({
      geometry: (latestRev.geometry ?? {}) as any,
      service: (latestRev.service ?? {}) as any,
      certs: (latestRev.certs ?? {}) as any,
      wallBuildup: (latestRev.wallBuildup ?? {}) as any,
    });
    await db.quote.update({
      where: { id: quoteId },
      data: { totalPrice: pricing.totalDelivered },
    });
  }

  // If we're keeping the existing project, allow in-place edits to its
  // name / site / description — matches prior behavior for already-linked
  // quotes.
  if (mode === 'keep' && activeProjectId) {
    const project = await db.project.findUnique({ where: { id: activeProjectId } });
    if (project && project.customerId === customerId) {
      const name        = String(formData.get('projectName') ?? '').trim() || project.name;
      const siteAddress = String(formData.get('siteAddress') ?? '').trim() || null;
      const description = String(formData.get('description') ?? '').trim() || null;
      await db.project.update({
        where: { id: activeProjectId },
        data: { name, siteAddress, description },
      });
      await writeAuditEntry(db, {
        entityType: 'Project',
        entityId: activeProjectId,
        actorUserId: user.id,
        action: 'update',
        diffJson: { name, siteAddress, description, via: 'send-step' },
      });
    }
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/quotes/${quoteId}`);
}
