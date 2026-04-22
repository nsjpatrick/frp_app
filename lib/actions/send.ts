'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { revalidatePath } from 'next/cache';

async function getUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user;
}

/**
 * Update the Customer + (optional) Project info attached to a quote from the
 * final recipient-confirmation step. Tenant-checked before every write.
 * No redirect — the client is going to fire the mailto link after this
 * resolves, so stay on the page.
 */
export async function saveRecipientForQuote(formData: FormData): Promise<void> {
  const user = await getUser();
  const customerId = String(formData.get('customerId') ?? '');
  const projectId  = formData.get('projectId') ? String(formData.get('projectId')) : null;

  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.tenantId !== user.tenantId) {
    throw new Error('customer not found');
  }

  const contactName  = String(formData.get('contactName') ?? '').trim() || null;
  const contactEmail = String(formData.get('contactEmail') ?? '').trim() || null;
  const contactPhoneRaw = String(formData.get('contactPhone') ?? '').trim();
  const contactPhone = contactPhoneRaw ? normalizePhone(contactPhoneRaw) : null;

  await db.customer.update({
    where: { id: customerId },
    data: { contactName, contactEmail, contactPhone },
  });

  await writeAuditEntry(db, {
    entityType: 'Customer',
    entityId: customerId,
    actorUserId: user.id,
    action: 'update:contact',
    diffJson: { contactName, contactEmail, contactPhone, via: 'send-step' },
  });

  if (projectId) {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (project && project.customerId === customerId) {
      const name        = String(formData.get('projectName') ?? '').trim() || project.name;
      const siteAddress = String(formData.get('siteAddress') ?? '').trim() || null;
      const description = String(formData.get('description') ?? '').trim() || null;

      await db.project.update({
        where: { id: projectId },
        data: { name, siteAddress, description },
      });

      await writeAuditEntry(db, {
        entityType: 'Project',
        entityId: projectId,
        actorUserId: user.id,
        action: 'update',
        diffJson: { name, siteAddress, description, via: 'send-step' },
      });
    }
  }

  revalidatePath(`/customers/${customerId}`);
}
