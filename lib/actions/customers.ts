'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { customerCreateSchema } from '@/lib/validators/entities';
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
  const parsed = customerCreateSchema.parse({
    name: formData.get('name'),
    contactName: formData.get('contactName') || undefined,
    contactEmail: formData.get('contactEmail') || undefined,
    contactPhone: formData.get('contactPhone') || undefined,
  });

  const customer = await db.customer.create({
    data: { ...parsed, tenantId: user.tenantId },
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
