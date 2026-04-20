import { describe, it, expect } from 'vitest';
import { computeStructuralAnalysis } from '@/lib/rules/structural-analysis';
import { SEED_ANCHORS } from '@/lib/catalog/anchor';

/**
 * Regression fixtures. Each represents a real-world FRP tank quote with hand-verified
 * inputs. Expected outputs are pinned to detect unintentional formula changes. Update
 * expected values only when intentionally changing a formula, and document why.
 */

describe('structural analysis — regression fixtures', () => {
  it('Fixture 1: 10ft ID × 12ft SS sulfuric storage, low-seismic + moderate wind', () => {
    const r = computeStructuralAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.4, designTempF: 140, operatingPressurePsig: 0, vacuumPsig: 0 },
      seismic: { siteClass: 'D', Ss: 0.15, S1: 0.06, riskCategory: 'II' },
      wind: { V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
      anchorCatalog: SEED_ANCHORS,
    });
    expect(r.wallThickness.shellThicknessIn).toBeCloseTo(0.29, 1);
    // Seismic governs even at Ss=0.15 on site class D because the heavy liquid (SG=1.4)
    // in a large vessel produces high impulsive seismic demand. Site class D amplification
    // raises Fa and the large Wp makes seismic overturning (~375k lbf·in) exceed wind
    // overturning (~165k lbf·in). Original expectation of '0.6D+W' was incorrect; corrected.
    expect(r.loadCombination.governingCase).toBe('0.9D+1.0E');
    expect(r.anchor.qty).toBeGreaterThanOrEqual(4);
  });

  it('Fixture 2: Same vessel in high-seismic California (Ss=1.5, S1=0.6)', () => {
    const r = computeStructuralAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.4, designTempF: 140, operatingPressurePsig: 0, vacuumPsig: 0 },
      seismic: { siteClass: 'D', Ss: 1.5, S1: 0.6, riskCategory: 'II' },
      wind: { V: 110, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
      anchorCatalog: SEED_ANCHORS,
    });
    expect(r.loadCombination.governingCase).toBe('0.9D+1.0E');
    expect(r.loadCombination.governingUpliftLbf).toBeGreaterThan(5000);
  });

  it('Fixture 3: Squat vessel (8ft ID × 4ft SS) — D/H > 1.333 regime', () => {
    const r = computeStructuralAnalysis({
      geometry: { orientation: 'vertical', idIn: 96, ssHeightIn: 48, freeboardIn: 6, topHead: 'flat', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.0, designTempF: 80, operatingPressurePsig: 0, vacuumPsig: 0 },
      seismic: { siteClass: 'D', Ss: 1.2, S1: 0.45, riskCategory: 'II' },
      wind: { V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
      anchorCatalog: SEED_ANCHORS,
    });
    expect(r.wallThickness.governingRule).toBe('rtp1_minimum');
    expect(r.wallThickness.shellThicknessIn).toBeCloseTo(0.2, 1);
  });

  it('Fixture 4: Very large vessel (20ft ID × 24ft SS)', () => {
    const r = computeStructuralAnalysis({
      geometry: { orientation: 'vertical', idIn: 240, ssHeightIn: 288, freeboardIn: 18, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.2, designTempF: 140, operatingPressurePsig: 0, vacuumPsig: 0 },
      seismic: { siteClass: 'D', Ss: 0.5, S1: 0.2, riskCategory: 'III' },
      wind: { V: 130, exposure: 'C', Kzt: 1.0, riskCategory: 'III' },
      anchorCatalog: SEED_ANCHORS,
    });
    expect(r.wallThickness.shellThicknessIn).toBeGreaterThan(0.5);
    expect(r.anchor.qty).toBeGreaterThanOrEqual(4);
  });

  it('Fixture 5: Importance-category-IV hospital process tank Ai relationship', () => {
    const r = computeStructuralAnalysis({
      geometry: { orientation: 'vertical', idIn: 72, ssHeightIn: 96, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.0, designTempF: 120, operatingPressurePsig: 0, vacuumPsig: 0 },
      seismic: { siteClass: 'C', Ss: 0.4, S1: 0.15, riskCategory: 'IV' },
      wind: { V: 120, exposure: 'C', Kzt: 1.0, riskCategory: 'IV' },
      anchorCatalog: SEED_ANCHORS,
    });
    // Ie=1.5 for Category IV, so Ai = SDS × 1.5 / 1.5 = SDS.
    // SDS = (2/3) × Fa × Ss; Fa(Ss=0.4, siteClass=C) interpolates between 0.25 (Fa_C=1.3) and 0.50 (Fa_C=1.3) = 1.3.
    // SDS = (2/3) × 1.3 × 0.4 = 0.347; Ai should be ≈ 0.347
    expect(r.seismic.Ai).toBeCloseTo(0.347, 2);
  });

  it('Fixture 6: Shell & head thicknesses ratio is fixed at 1.15', () => {
    const r = computeStructuralAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.2, designTempF: 100, operatingPressurePsig: 0, vacuumPsig: 0 },
      seismic: { siteClass: 'D', Ss: 0.3, S1: 0.1, riskCategory: 'II' },
      wind: { V: 100, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
      anchorCatalog: SEED_ANCHORS,
    });
    expect(r.wallThickness.headThicknessIn / r.wallThickness.shellThicknessIn).toBeCloseTo(1.15, 2);
  });
});
