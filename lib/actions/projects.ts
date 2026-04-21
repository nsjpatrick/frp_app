'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { projectCreateSchema, projectUpdateSchema } from '@/lib/validators/entities';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { revalidatePath } from 'next/cache';
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
    description: formData.get('description') || undefined,
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

/**
 * Update the editable project fields (title, description, location, need-by).
 * Tenant-ownership check on the FK before any write — same pattern we use
 * across all server actions.
 */
export async function updateProject(formData: FormData) {
  const user = await getUser();
  const parsed = projectUpdateSchema.parse({
    projectId: formData.get('projectId'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    siteAddress: formData.get('siteAddress') || undefined,
    needByDate: formData.get('needByDate') || undefined,
  });

  const project = await db.project.findUnique({
    where: { id: parsed.projectId },
    include: { customer: true },
  });
  if (!project || project.customer.tenantId !== user.tenantId) {
    throw new Error('project not found');
  }

  await db.project.update({
    where: { id: parsed.projectId },
    data: {
      name: parsed.name,
      description: parsed.description ?? null,
      siteAddress: parsed.siteAddress ?? null,
      needByDate: parsed.needByDate ? new Date(parsed.needByDate) : null,
    },
  });

  await writeAuditEntry(db, {
    entityType: 'Project',
    entityId: parsed.projectId,
    actorUserId: user.id,
    action: 'update',
    diffJson: parsed,
  });

  revalidatePath(`/projects/${parsed.projectId}`);
}
