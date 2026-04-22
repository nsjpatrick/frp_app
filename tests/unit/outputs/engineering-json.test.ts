import { describe, it, expect } from 'vitest';
import { buildEngineeringJson } from '@/lib/outputs/engineering-json';

const fixture = {
  quote: {
    id: 'q1',
    number: 'Q-2026-0001',
    customer: { id: 'c1', name: 'Acme', contactName: 'Jane', contactEmail: 'j@acme', contactPhone: '555' },
    project: { id: 'p1', name: 'Test', siteAddress: '123 Main', endUse: 'storage', needByDate: null },
  },
  revision: {
    id: 'r1',
    label: 'A',
    service: { chemical: 'H2SO4', chemicalFamily: 'dilute_acid', concentrationPct: 50, operatingTempF: 120, designTempF: 140, specificGravity: 1.4, operatingPressurePsig: 0, vacuumPsig: 0 },
    site: { indoor: false, seismic: { siteClass: 'D', Ss: 1.2, S1: 0.4, Ie: 1.0, riskCategory: 'II' }, wind: { V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II' } },
    certs: { asmeRtp1Class: 'II', asmeRtp1StdRevision: 'RTP-1:2019', ansiStandards: [], nsfAnsi61Required: false, nsfAnsi2Required: false, thirdPartyInspector: 'NONE', requiredDocuments: [] },
    geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, topHead: 'F_AND_D', bottom: 'flat_ring_supported', freeboardIn: 12 },
    wallBuildup: { resinId: 'derakane-411-350' },
  },
} as const;

describe('buildEngineeringJson', () => {
  it('produces schema_version 1.0.0 and required blocks', () => {
    const json = buildEngineeringJson(fixture as any, { rulesEngineVersion: '0.1.0', catalogSnapshotId: 'seed-v0' });
    expect(json.schema_version).toBe('1.0.0');
    expect(json.quote_id).toBe('Q-2026-0001');
    expect(json.revision).toBe('A');
    expect(json.customer.name).toBe('Acme');
    expect(json.service.chemical).toBe('H2SO4');
    expect(json.site.seismic.Ss).toBe(1.2);
    expect(json.certifications.asme_rtp1?.class).toBe('II');
    expect(json.geometry.id_in).toBe(120);
    expect(json.wall_buildup.corrosion_barrier.resin).toBe('derakane-411-350');
    expect(json.rules_engine_version).toBe('0.1.0');
    expect(json.catalog_snapshot_id).toBe('seed-v0');
  });

  it('produces deterministic output (identical JSON for identical inputs)', () => {
    const a = buildEngineeringJson(fixture as any, { rulesEngineVersion: '0.1.0', catalogSnapshotId: 'seed-v0', generatedAt: '2026-04-20T12:00:00Z' });
    const b = buildEngineeringJson(fixture as any, { rulesEngineVersion: '0.1.0', catalogSnapshotId: 'seed-v0', generatedAt: '2026-04-20T12:00:00Z' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('includes structural_analysis when revision has outputs.structuralAnalysis', () => {
    const withAnalysis = {
      ...fixture,
      revision: {
        ...fixture.revision,
        outputs: {
          structuralAnalysis: {
            wallThickness: { shellThicknessIn: 0.3, headThicknessIn: 0.345, governingRule: 'hoop_pressure', engineVersion: 'wall-thickness-v1', citations: [] },
            wind: { qzPsf: 25, Cf: 0.7, baseShearLbf: 1000, overturningMomentLbfIn: 100_000, projectedAreaFt2: 120, meanHeightFt: 6, engineVersion: 'wind-v1', citations: [] },
            seismic: { SDS: 0.8, SD1: 0.5, Ai: 0.53, Ac: 0.2, Wi_lb: 40_000, Wc_lb: 5000, Hi_in: 54, Hc_in: 70, baseShearLbf: 21_500, overturningMomentLbfIn: 1_200_000, requiredFreeboardIn: 10, engineVersion: 'seismic-v1', citations: [] },
            loadCombination: { governingCase: '0.9D+1.0E', governingUpliftLbf: 18_000, governingLateralLbf: 21_500, governingOverturningLbfIn: 1_200_000, engineVersion: 'load-combinations-v1' },
            anchor: { anchorDetailId: 'ss316-3-4', qty: 8, requiredCapacityLbf: 45_000, selectedCapacityLbfEach: 4200, pitch: 'acceptable', engineVersion: 'anchor-sizing-v1' },
            preliminary: true,
            reviewRequired: true,
            engineVersion: '0.2.0-rules-depth',
          },
        },
      },
    };
    const json = buildEngineeringJson(withAnalysis as any, { rulesEngineVersion: '0.2.0', catalogSnapshotId: 'seed-v0' });
    expect(json.structural_analysis).not.toBeNull();
    expect(json.structural_analysis.loadCombination.governingCase).toBe('0.9D+1.0E');
    expect(json.structural_analysis.anchor.qty).toBe(8);
  });
});
