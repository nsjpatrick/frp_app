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

export async function createQuote(formData: FormData) {
  const user = await getUser();
  const projectId = String(formData.get('projectId'));
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { customer: true },
  });
  if (!project || project.customer.tenantId !== user.tenantId) throw new Error('not found');

  const quote = await db.quote.create({
    data: { projectId, number: quoteNumber() },
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
    diffJson: { number: quote.number },
  });

  redirect(`/quotes/${quote.id}/rev/${rev.label}/step-1`);
}
