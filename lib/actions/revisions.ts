'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import {
  accessoriesSchema,
  certificationRequirementsSchema,
  geometrySchema,
  overallGeometrySchema,
  serviceConditionsSchema,
  siteEnvSchema,
} from '@/lib/validators/entities';
import { getDefaultsForTankType } from '@/lib/catalog/tank-type-defaults';
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
    include: { quote: { include: { customer: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== tenantId) throw new Error('not found');
  return rev;
}

/**
 * Reset every JSON column on a revision back to FRP Vessel defaults
 * (the same starting point a fresh quote shows). Wipes service, certs,
 * site, geometry, wallBuildup, and clears the structural-analysis
 * snapshot. After it resolves the client redirects to Step 1.
 *
 * The Reset-all-fields button on the wizard top bar is the only caller.
 * Save state on every other revision is untouched.
 */
export async function resetRevisionToDefaults(quoteId: string, label: string) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);

  const d = getDefaultsForTankType('frp_vessel');
  // Service — keep tankType set to FRP Vessel so the cascade replays
  // cleanly when the rep lands on Step 1.
  const service: any = {
    tankType: 'frp_vessel',
    chemical: '',
    chemicalFamily: d.service.chemicalFamily,
    operatingTempF: d.service.operatingTempF,
    designTempF: d.service.designTempF,
    minAmbientTempF: d.service.minAmbientTempF,
    specificGravity: d.service.specificGravity,
    operatingPressurePsig: d.service.operatingPressurePsig,
    vacuumPsig: d.service.vacuumPsig,
    postCure: d.service.postCure,
    installationLocation: d.service.installationLocation,
    tankColor: d.service.tankColor,
  };

  const certs: any = {
    asmeRtp1Class: d.certs.asmeRtp1Class ?? null,
    nsfAnsi61Required: d.certs.nsfAnsi61Required,
    nsfAnsi2Required: d.certs.nsfAnsi2Required,
    astmD3299: true,
    astmD4097: true,
    astmD5685: false,
    peStamp: false,
    iccEsListed: false,
    thirdPartyInspector: 'NONE',
    ansiStandards: [],
    requiredDocuments: [],
  };

  // Site — wipe seismic/wind values so the rep re-runs the postal
  // lookup against the now-default site profile.
  const site: any = {
    indoor: false,
    seismic: { siteClass: 'D', Ss: null, S1: null, Ie: 1.0, riskCategory: 'II' },
    wind: { V: null, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
  };

  // Geometry — full FRP defaults including the Step-2 fields
  // (heads, baffles, stand, accessories, nozzle schedule).
  const accessories = accessoriesSchema.parse(d.accessories);
  const geometry: any = {
    orientation: d.geometry.orientation,
    // FRP Vessel defaults leave size empty so the rep must enter
    // diameter + SS-height before pricing engages. Anything previously
    // saved gets blown away here so a reset truly returns to "blank".
    idIn: d.geometry.idIn ?? null,
    ssHeightIn: d.geometry.ssHeightIn ?? null,
    freeboardIn: d.geometry.freeboardIn,
    quantity: 1,
    doubleWall: d.geometry.doubleWall,
    topHead: d.geometry.topHead,
    bottom: d.geometry.bottom,
    nozzles: d.geometry.nozzles,
    baffles: d.geometry.baffles,
    baffleCount: d.geometry.baffleCount,
    baffleType: d.geometry.baffleType,
    baffleLengthFt: 0, // 0 = auto-derive from height
    standType: d.geometry.stainlessStand ? 'ss316' : 'none',
    standHeightFt: 4,
    stainlessStand: d.geometry.stainlessStand,
    stainlessGrade: null,
    accessories,
  };

  const wallBuildup: any = {
    resinId: d.wallBuildup.resinId,
    veilId:  d.wallBuildup.veilId,
  };

  await db.revision.update({
    where: { id: rev.id },
    data: {
      service,
      certs,
      site,
      geometry,
      wallBuildup,
    },
  });

  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: rev.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'reset:to-defaults',
    diffJson: { reset: true, defaults: 'frp_vessel' },
  });

  redirect(`/quotes/${quoteId}/rev/${label}/step-1`);
}

/**
 * Persist the rep's free-form Comments & Exceptions notes onto the
 * revision. Stored under `outputs.engineeringNotes` so the engineering
 * JSON download surfaces them, but the customer-facing Quote PDF does
 * not (the PDF builder ignores this field by design).
 */
export async function saveEngineeringNotes(
  quoteId: string,
  label: string,
  formData: FormData,
) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);

  const raw = String(formData.get('engineeringNotes') ?? '').trim();
  // Cap free-form notes so a runaway paste doesn't bloat the JSON column.
  const notes = raw.slice(0, 10_000);

  const existingOutputs: any = rev.outputs ?? {};
  const nextOutputs = { ...existingOutputs };
  if (notes.length > 0) {
    nextOutputs.engineeringNotes = notes;
  } else {
    delete nextOutputs.engineeringNotes;
  }

  await db.revision.update({
    where: { id: rev.id },
    data: { outputs: nextOutputs },
  });

  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: rev.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'update:engineering-notes',
    diffJson: { notesLength: notes.length },
  });

  redirect(`/quotes/${quoteId}/rev/${label}/review`);
}

export async function saveServiceStep(quoteId: string, label: string, formData: FormData) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);

  const service = serviceConditionsSchema.parse({
    tankType: formData.get('tankType') ? String(formData.get('tankType')) : undefined,
    chemical: formData.get('chemical'),
    chemicalFamily: formData.get('chemicalFamily'),
    concentrationPct: formData.get('concentrationPct') ? Number(formData.get('concentrationPct')) : undefined,
    operatingTempF: Number(formData.get('operatingTempF')),
    designTempF: Number(formData.get('designTempF')),
    minAmbientTempF: formData.get('minAmbientTempF') != null && formData.get('minAmbientTempF') !== ''
      ? Number(formData.get('minAmbientTempF'))
      : undefined,
    specificGravity: Number(formData.get('specificGravity')),
    operatingPressurePsig: Number(formData.get('operatingPressurePsig')),
    vacuumPsig: Number(formData.get('vacuumPsig')),
    postCure: formData.get('postCure') === 'on',
    installationLocation: (formData.get('installationLocation') as 'indoor' | 'outdoor' | null) ?? 'outdoor',
    tankColor: (formData.get('tankColor') as 'wax' | 'white' | 'grey' | 'other' | null) ?? 'wax',
  });

  const certs = certificationRequirementsSchema.parse({
    asmeRtp1Class: formData.get('asmeRtp1Class') || null,
    asmeRtp1StdRevision: formData.get('asmeRtp1StdRevision') || undefined,
    ansiStandards: JSON.parse(String(formData.get('ansiStandards') || '[]')),
    nsfAnsi61Required: formData.get('nsfAnsi61Required') === 'on',
    nsfAnsi61TargetTempF: formData.get('nsfAnsi61TargetTempF') ? Number(formData.get('nsfAnsi61TargetTempF')) : undefined,
    nsfAnsi2Required: formData.get('nsfAnsi2Required') === 'on',
    astmD3299: formData.get('astmD3299') === 'on',
    astmD4097: formData.get('astmD4097') === 'on',
    astmD5685: formData.get('astmD5685') === 'on',
    peStamp: formData.get('peStamp') === 'on',
    iccEsListed: formData.get('iccEsListed') === 'on',
    thirdPartyInspector: (formData.get('thirdPartyInspector') || 'NONE') as any,
    requiredDocuments: JSON.parse(String(formData.get('requiredDocuments') || '[]')),
  });

  const site = siteEnvSchema.parse(JSON.parse(String(formData.get('siteJson'))));

  // Resin + veil both live on the chemistry step — both define the
  // corrosion-barrier layup. We merge into the existing wallBuildup
  // JSON so any other fields persisted there stay intact.
  const resinIdRaw = String(formData.get('resinId') ?? '').trim();
  const veilIdRaw  = String(formData.get('veilId')  ?? '').trim();
  const existingWallBuildup = (rev.wallBuildup ?? {}) as any;
  const wallBuildup = {
    ...existingWallBuildup,
    ...(resinIdRaw ? { resinId: resinIdRaw } : {}),
    ...(veilIdRaw  ? { veilId:  veilIdRaw  } : {}),
  };

  // Step 1 now also captures the overall vessel geometry (orientation,
  // idIn, ssHeightIn, freeboardIn, quantity). The form uses feet for rep
  // ergonomics; we convert to inches at this seam so the schema, pricing
  // engine, and structural calcs all keep their inch-based contract.
  // We merge into rev.geometry preserving Step 2's fields (topHead,
  // bottom, nozzles, baffles, stand, accessories) so a back-and-forth
  // between steps doesn't clobber anything.
  const quantityRaw = Number(formData.get('quantity'));
  const ftToIn = (v: FormDataEntryValue | null): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n * 12 : NaN;
  };
  const overallGeometry = overallGeometrySchema.parse({
    orientation: formData.get('orientation'),
    idIn: ftToIn(formData.get('idFt')),
    ssHeightIn: ftToIn(formData.get('ssHeightFt')),
    freeboardIn: ftToIn(formData.get('freeboardFt')),
    quantity: Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1,
    doubleWall: formData.get('doubleWall') === 'on',
  });
  const existingGeom = (rev.geometry ?? {}) as Record<string, unknown>;
  const mergedGeometry = { ...existingGeom, ...overallGeometry };

  await db.revision.update({
    where: { id: rev.id },
    data: { service, certs, site, wallBuildup: wallBuildup as any, geometry: mergedGeometry as any },
  });

  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: rev.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'update:service+certs+site+overall',
    diffJson: { service, certs, site, geometry: mergedGeometry },
  });

  await recomputeStructuralAnalysis(rev.id);
  redirect(`/quotes/${quoteId}/rev/${label}/step-2`);
}

export async function saveGeometryStep(quoteId: string, label: string, formData: FormData) {
  const user = await getUser();
  const rev = await loadRevision(quoteId, label, user.tenantId);

  // Overall vessel geometry (orientation/idIn/ssHeightIn/freeboardIn/
  // quantity) is owned by Step 1 — read it back from the persisted rev so
  // Step 2 can submit only its own fields. This stops a tab-switch + Save
  // cycle from clobbering the overall data the rep already entered.
  const persisted = (rev.geometry ?? {}) as Record<string, unknown>;
  // Accessories are serialized as JSON by `AccessoriesSection`; bad JSON
  // falls through the schema's `.default({})` so we never block the form.
  const accessories = (() => {
    try {
      const raw = formData.get('accessoriesJson');
      return raw ? JSON.parse(String(raw)) : undefined;
    } catch {
      return undefined;
    }
  })();
  const geometry = geometrySchema.parse({
    orientation: persisted.orientation ?? 'vertical',
    idIn: Number(persisted.idIn),
    ssHeightIn: Number(persisted.ssHeightIn),
    freeboardIn: Number(persisted.freeboardIn ?? 0),
    quantity: Number.isFinite(persisted.quantity as number) ? Number(persisted.quantity) : 1,
    doubleWall: !!persisted.doubleWall,
    topHead: formData.get('topHead'),
    bottom: formData.get('bottom'),
    nozzles: (() => {
      try {
        const raw = formData.get('nozzlesJson');
        return raw ? JSON.parse(String(raw)) : [];
      } catch {
        return [];
      }
    })(),
    // Baffles toggle was retired — having a non-zero count IS the
    // toggle. Type + length stay populated even when count = 0 so the
    // rep's prior choices survive a temporary "0 baffles" excursion.
    baffles: Number(formData.get('baffleCount') || 0) > 0,
    baffleCount: Number(formData.get('baffleCount') || 0),
    baffleType: (formData.get('baffleType') as 'plate' | 'wedge' | null) ?? 'plate',
    baffleLengthFt: Number(formData.get('baffleLengthFt') || 0),
    // standType is the new canonical field; we still derive the legacy
    // stainlessStand / stainlessGrade so any reader that hasn't been
    // updated yet keeps working.
    standType: (formData.get('standType') as string | null) ?? 'none',
    standHeightFt: Number(formData.get('standHeightFt')) || 4,
    stainlessStand: ['ss304', 'ss316'].includes(String(formData.get('standType') ?? '')),
    stainlessGrade:
      formData.get('standType') === 'ss304' ? 'SS304' :
      formData.get('standType') === 'ss316' ? 'SS316' :
      null,
    accessories,
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
