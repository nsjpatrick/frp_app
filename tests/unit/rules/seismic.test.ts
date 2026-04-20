import { describe, it, expect } from 'vitest';
import { computeSeismicAnalysis, designSpectralAccelerations } from '@/lib/rules/seismic';

describe('designSpectralAccelerations — ASCE 7-22 §11.4', () => {
  it('applies site coefficients Fa/Fv and 2/3 factor', () => {
    // Ss=1.2, siteClass=D: FA_TABLE interpolate between 1.00 (Fa=1.1) and 1.25 (Fa=1.0)
    // frac=(1.2-1.0)/(1.25-1.0)=0.8 → Fa=1.1+0.8×(1.0-1.1)=1.02 → SMS=1.224 → SDS=0.816
    // S1=0.45, siteClass=D: FV_TABLE interpolate between 0.40 (Fv=1.9) and 0.50 (Fv=1.8)
    // frac=(0.45-0.40)/(0.50-0.40)=0.5 → Fv=1.85 → SM1=0.8325 → SD1=0.555
    const r = designSpectralAccelerations({ Ss: 1.2, S1: 0.45, siteClass: 'D' });
    expect(r.SDS).toBeCloseTo(0.816, 2);
    expect(r.SD1).toBeCloseTo(0.555, 2);
  });

  it('interpolates Fa between table rows', () => {
    const r = designSpectralAccelerations({ Ss: 0.60, S1: 0.30, siteClass: 'D' });
    expect(r.SDS).toBeCloseTo(0.528, 2);
  });
});

describe('computeSeismicAnalysis — API 650 App E mass decomposition', () => {
  it('produces reasonable impulsive and convective weights for typical tall vessel', () => {
    const r = computeSeismicAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.0, designTempF: 80, operatingPressurePsig: 0, vacuumPsig: 0 },
      site: { siteClass: 'D', Ss: 1.2, S1: 0.45, riskCategory: 'II' },
    });
    expect(r.SDS).toBeCloseTo(0.816, 2);
    expect(r.SD1).toBeCloseTo(0.555, 2);
    expect(r.Wi_lb).toBeGreaterThan(35_000);
    expect(r.Wi_lb).toBeLessThan(55_000);
    expect(r.baseShearLbf).toBeGreaterThan(0);
    expect(r.overturningMomentLbfIn).toBeGreaterThan(0);
    expect(r.requiredFreeboardIn).toBeGreaterThan(0);
  });

  it('scales with specific gravity', () => {
    const base = computeSeismicAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.0, designTempF: 80, operatingPressurePsig: 0, vacuumPsig: 0 },
      site: { siteClass: 'D', Ss: 1.2, S1: 0.45, riskCategory: 'II' },
    });
    const heavy = computeSeismicAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.8, designTempF: 80, operatingPressurePsig: 0, vacuumPsig: 0 },
      site: { siteClass: 'D', Ss: 1.2, S1: 0.45, riskCategory: 'II' },
    });
    // precision -2 allows ±5 lbf; rounding from .toFixed(0) means the two independently
    // rounded integers can differ by ~1 from exact 1.8× scaling
    expect(heavy.baseShearLbf / base.baseShearLbf).toBeCloseTo(1.8, 1);
  });

  it('includes citations', () => {
    const r = computeSeismicAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.0, designTempF: 80, operatingPressurePsig: 0, vacuumPsig: 0 },
      site: { siteClass: 'D', Ss: 1.2, S1: 0.45, riskCategory: 'II' },
    });
    expect(r.citations).toContain('ASCE 7-22 §15.7');
    expect(r.citations).toContain('API 650 App E');
  });
});
