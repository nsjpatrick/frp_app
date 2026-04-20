'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { projectCreateSchema } from '@/lib/validators/entities';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { redirect } from 'next/navigation';

async function getUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user;
}

export async function createProject(formData: FormData) {
  const user = await getUser();
  const parsed = projectCreateSchema.parse({
    customerId: formData.get('customerId'),
    name: formData.get('name'),
    customerProjectNumber: formData.get('customerProjectNumber') || undefined,
    siteAddress: formData.get('siteAddress') || undefined,
    endUse: formData.get('endUse') || undefined,
    needByDate: formData.get('needByDate') || undefined,
  });

  const customer = await db.customer.findUnique({ where: { id: parsed.customerId } });
  if (!customer || customer.tenantId !== user.tenantId) throw new Error('customer not found');

  const project = await db.project.create({
    data: {
      ...parsed,
      needByDate: parsed.needByDate ? new Date(parsed.needByDate) : null,
    },
  });

  await writeAuditEntry(db, {
    entityType: 'Project',
    entityId: project.id,
    actorUserId: user.id,
    action: 'create',
    diffJson: parsed,
  });

  redirect(`/projects/${project.id}`);
}
