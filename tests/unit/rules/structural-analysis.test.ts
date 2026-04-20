import { describe, it, expect } from 'vitest';
import { computeStructuralAnalysis } from '@/lib/rules/structural-analysis';
import { SEED_ANCHORS } from '@/lib/catalog/anchor';

describe('computeStructuralAnalysis — full integration', () => {
  it('produces a complete result for typical 10ft×12ft vessel', () => {
    const r = computeStructuralAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.4, designTempF: 140, operatingPressurePsig: 0, vacuumPsig: 0 },
      seismic: { siteClass: 'D', Ss: 1.2, S1: 0.45, riskCategory: 'II' },
      wind: { V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
      anchorCatalog: SEED_ANCHORS,
    });
    expect(r.wallThickness.shellThicknessIn).toBeGreaterThan(0);
    expect(r.wind.baseShearLbf).toBeGreaterThan(0);
    expect(r.seismic.baseShearLbf).toBeGreaterThan(0);
    expect(r.loadCombination.governingUpliftLbf).toBeGreaterThanOrEqual(0);
    expect(r.anchor.qty).toBeGreaterThanOrEqual(4);
    expect(r.preliminary).toBe(true);
    expect(r.reviewRequired).toBe(true);
  });

  it('governing case is seismic for high Ss + low wind', () => {
    const r = computeStructuralAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.4, designTempF: 140, operatingPressurePsig: 0, vacuumPsig: 0 },
      seismic: { siteClass: 'D', Ss: 1.5, S1: 0.6, riskCategory: 'II' },
      wind: { V: 90, exposure: 'B', Kzt: 1.0, riskCategory: 'II' },
      anchorCatalog: SEED_ANCHORS,
    });
    expect(r.loadCombination.governingCase).toBe('0.9D+1.0E');
  });
});
