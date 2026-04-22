'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { redirect } from 'next/navigation';

async function getUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user;
}

function quoteNumber(): string {
  const y = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `Q-${y}-${rand}`;
}

/**
 * Create a new Quote (+ Revision A) and redirect into the wizard.
 *
 * Accepts either `projectId` (existing flow) or `customerId` (project-less
 * quote). When both are given, projectId wins and customerId is re-derived
 * from the project to guarantee consistency.
 */
export async function createQuote(formData: FormData) {
  const user = await getUser();

  const projectIdRaw = formData.get('projectId');
  const customerIdRaw = formData.get('customerId');
  const projectId = projectIdRaw ? String(projectIdRaw) : null;
  let customerId = customerIdRaw ? String(customerIdRaw) : null;

  if (!projectId && !customerId) {
    throw new Error('customerId or projectId required');
  }

  // Resolve + tenant-check both the customer and (optional) project.
  if (projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { customer: true },
    });
    if (!project || project.customer.tenantId !== user.tenantId) {
      throw new Error('project not found');
    }
    customerId = project.customerId;
  } else {
    const customer = await db.customer.findUnique({ where: { id: customerId! } });
    if (!customer || customer.tenantId !== user.tenantId) {
      throw new Error('customer not found');
    }
  }

  const quote = await db.quote.create({
    data: {
      projectId,
      customerId: customerId!,
      number: quoteNumber(),
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
    diffJson: { number: quote.number, projectId, customerId },
  });

  redirect(`/quotes/${quote.id}/rev/${rev.label}/step-1`);
}
