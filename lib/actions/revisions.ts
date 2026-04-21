'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { serviceConditionsSchema, certificationRequirementsSchema, siteEnvSchema, geometrySchema } from '@/lib/validators/entities';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { redirect } from 'next/navigation';
import { computeStructuralAnalysis } from '@/lib/rules/structural-analysis';
import { SEED_ANCHORS } from '@/lib/catalog/anchor';

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
    postCure: formData.get('postCure') === 'on',
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

  await recomputeStructuralAnalysis(rev.id);
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
    nozzles: (() => {
      try {
        const raw = formData.get('nozzlesJson');
        return raw ? JSON.parse(String(raw)) : [];
      } catch {
        return [];
      }
    })(),
    baffles: formData.get('baffles') === 'on',
    baffleCount: formData.get('baffles') === 'on' ? Number(formData.get('baffleCount') || 0) : 0,
    stainlessStand: formData.get('stainlessStand') === 'on',
    stainlessGrade: formData.get('stainlessStand') === 'on'
      ? (formData.get('stainlessGrade') as string | null) || null
      : null,
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

  await recomputeStructuralAnalysis(rev.id);
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

  await recomputeStructuralAnalysis(rev.id);
  redirect(`/quotes/${quoteId}/rev/${label}/review`);
}

async function recomputeStructuralAnalysis(revisionId: string): Promise<void> {
  const rev = await db.revision.findUnique({ where: { id: revisionId } });
  if (!rev) return;

  const geometry: any = rev.geometry;
  const service: any = rev.service;
  const site: any = rev.site;

  if (!geometry || !service || !site) return;

  try {
    const result = computeStructuralAnalysis({
      geometry: {
        orientation: geometry.orientation,
        idIn: geometry.idIn,
        ssHeightIn: geometry.ssHeightIn,
        freeboardIn: geometry.freeboardIn,
        topHead: geometry.topHead,
        bottom: geometry.bottom,
      },
      service: {
        specificGravity: service.specificGravity,
        designTempF: service.designTempF,
        operatingPressurePsig: service.operatingPressurePsig,
        vacuumPsig: service.vacuumPsig,
      },
      seismic: {
        siteClass: site.seismic.siteClass,
        Ss: site.seismic.Ss,
        S1: site.seismic.S1,
        riskCategory: site.seismic.riskCategory,
      },
      wind: {
        V: site.wind.V,
        exposure: site.wind.exposure,
        Kzt: site.wind.Kzt,
        riskCategory: site.wind.riskCategory,
      },
      anchorCatalog: SEED_ANCHORS,
    });

    const existingOutputs: any = rev.outputs ?? {};
    await db.revision.update({
      where: { id: revisionId },
      data: { outputs: { ...existingOutputs, structuralAnalysis: result } },
    });
  } catch (e) {
    const existingOutputs: any = rev.outputs ?? {};
    await db.revision.update({
      where: { id: revisionId },
      data: {
        outputs: {
          ...existingOutputs,
          structuralAnalysisError: e instanceof Error ? e.message : String(e),
        },
      },
    });
  }
}
