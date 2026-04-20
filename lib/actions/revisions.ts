'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { serviceConditionsSchema, certificationRequirementsSchema, siteEnvSchema, geometrySchema } from '@/lib/validators/entities';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { redirect } from 'next/navigation';

async function getUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user;
}

async function loadRevision(quoteId: string, label: string, tenantId: string) {
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== tenantId) throw new Error('not found');
  return rev;
}

export async function saveServiceStep(quoteId: string, label: string, formData: FormData) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);

  const service = serviceConditionsSchema.parse({
    chemical: formData.get('chemical'),
    chemicalFamily: formData.get('chemicalFamily'),
    concentrationPct: formData.get('concentrationPct') ? Number(formData.get('concentrationPct')) : undefined,
    operatingTempF: Number(formData.get('operatingTempF')),
    designTempF: Number(formData.get('designTempF')),
    specificGravity: Number(formData.get('specificGravity')),
    operatingPressurePsig: Number(formData.get('operatingPressurePsig')),
    vacuumPsig: Number(formData.get('vacuumPsig')),
  });

  const certs = certificationRequirementsSchema.parse({
    asmeRtp1Class: formData.get('asmeRtp1Class') || null,
    asmeRtp1StdRevision: formData.get('asmeRtp1StdRevision') || undefined,
    ansiStandards: JSON.parse(String(formData.get('ansiStandards') || '[]')),
    nsfAnsi61Required: formData.get('nsfAnsi61Required') === 'on',
    nsfAnsi61TargetTempF: formData.get('nsfAnsi61TargetTempF') ? Number(formData.get('nsfAnsi61TargetTempF')) : undefined,
    nsfAnsi2Required: formData.get('nsfAnsi2Required') === 'on',
    thirdPartyInspector: (formData.get('thirdPartyInspector') || 'NONE') as any,
    requiredDocuments: JSON.parse(String(formData.get('requiredDocuments') || '[]')),
  });

  const site = siteEnvSchema.parse(JSON.parse(String(formData.get('siteJson'))));

  await db.revision.update({
    where: { id: rev.id },
    data: { service, certs, site },
  });

  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: rev.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'update:service+certs+site',
    diffJson: { service, certs, site },
  });

  redirect(`/quotes/${quoteId}/rev/${label}/step-3`);
}

export async function saveGeometryStep(quoteId: string, label: string, formData: FormData) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);

  const geometry = geometrySchema.parse({
    orientation: formData.get('orientation'),
    idIn: Number(formData.get('idIn')),
    ssHeightIn: Number(formData.get('ssHeightIn')),
    topHead: formData.get('topHead'),
    bottom: formData.get('bottom'),
    freeboardIn: Number(formData.get('freeboardIn')),
  });

  await db.revision.update({ where: { id: rev.id }, data: { geometry } });
  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: rev.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'update:geometry',
    diffJson: { geometry },
  });

  redirect(`/quotes/${quoteId}/rev/${label}/step-4`);
}

export async function saveResinStep(quoteId: string, label: string, formData: FormData) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);
  const resinId = String(formData.get('resinId'));

  await db.revision.update({ where: { id: rev.id }, data: { wallBuildup: { resinId } } });
  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: rev.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'update:resin',
    diffJson: { resinId },
  });

  redirect(`/quotes/${quoteId}/rev/${label}/review`);
}
