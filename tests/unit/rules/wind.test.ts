import { describe, it, expect } from 'vitest';
import { computeWindAnalysis, velocityPressureQz } from '@/lib/rules/wind';

describe('velocityPressureQz — ASCE 7-22 §26.10', () => {
  it('computes qh for 10ft tall tank, Exposure C, V=115', () => {
    // Per ASCE 7-22 Eq. 26.10-1 (no Iw): qz = 0.00256 × 0.85 × 1.0 × 0.95 × 115² = 27.3 psf
    const q = velocityPressureQz({
      V: 115,
      exposure: 'C',
      Kzt: 1.0,
      riskCategory: 'II',
      heightFt: 10,
    });
    expect(q).toBeCloseTo(27.3, 0);
  });

  it('scales with V²', () => {
    const q90 = velocityPressureQz({ V: 90, exposure: 'C', Kzt: 1.0, riskCategory: 'II', heightFt: 10 });
    const q180 = velocityPressureQz({ V: 180, exposure: 'C', Kzt: 1.0, riskCategory: 'II', heightFt: 10 });
    expect(q180 / q90).toBeCloseTo(4, 1);
  });

  it('does NOT apply Iw — risk category carried only by input V per ASCE 7-16/22', () => {
    // qz itself does not change with riskCategory at the same V. Callers must pass a
    // risk-adjusted V from the ASCE Hazard Tool (different V mapped per Risk I/II/III/IV).
    const q2 = velocityPressureQz({ V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II', heightFt: 10 });
    const q4 = velocityPressureQz({ V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'IV', heightFt: 10 });
    expect(q4).toBeCloseTo(q2, 5);
  });
});

describe('computeWindAnalysis — full', () => {
  it('produces base shear, overturning, and area for 10ft×12ft vessel', () => {
    const r = computeWindAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      wind: { V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
    });
    expect(r.qzPsf).toBeGreaterThan(20);
    expect(r.qzPsf).toBeLessThan(35);
    expect(r.Cf).toBeCloseTo(0.7, 1);
    expect(r.projectedAreaFt2).toBeCloseTo(120, 0);
    expect(r.baseShearLbf).toBeGreaterThan(0);
    expect(r.overturningMomentLbfIn).toBeGreaterThan(0);
    expect(r.citations).toContain('ASCE 7-22 §26.10');
    expect(r.citations).toContain('ASCE 7-22 Table 29.4-1');
  });

  it('larger exposure D gives higher base shear than C', () => {
    const c = computeWindAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      wind: { V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
    });
    const d = computeWindAnalysis({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      wind: { V: 115, exposure: 'D', Kzt: 1.0, riskCategory: 'II' },
    });
    expect(d.baseShearLbf).toBeGreaterThan(c.baseShearLbf);
  });
});
