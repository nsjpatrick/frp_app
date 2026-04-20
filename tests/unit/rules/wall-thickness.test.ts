import { describe, it, expect } from 'vitest';
import { computeWallThickness } from '@/lib/rules/wall-thickness';

describe('computeWallThickness — ASTM D3299 hoop', () => {
  it('returns hoop-governed thickness for typical 10ft x 12ft vessel', () => {
    const r = computeWallThickness({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.4, designTempF: 140, operatingPressurePsig: 0, vacuumPsig: 0 },
    });
    expect(r.shellThicknessIn).toBeCloseTo(0.29, 2);
    expect(r.governingRule).toBe('hoop_pressure');
  });

  it('switches to RTP-1 minimum for small vessels with low head', () => {
    const r = computeWallThickness({
      geometry: { orientation: 'vertical', idIn: 48, ssHeightIn: 48, freeboardIn: 6, topHead: 'flat', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.0, designTempF: 80, operatingPressurePsig: 0, vacuumPsig: 0 },
    });
    expect(r.shellThicknessIn).toBeCloseTo(0.1875, 4);
    expect(r.governingRule).toBe('rtp1_minimum');
  });

  it('accounts for surface pressure', () => {
    const r = computeWallThickness({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.0, designTempF: 80, operatingPressurePsig: 10, vacuumPsig: 0 },
    });
    expect(r.shellThicknessIn).toBeCloseTo(0.608, 2);
  });

  it('head thickness is 115% of shell minimum', () => {
    const r = computeWallThickness({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.0, designTempF: 80, operatingPressurePsig: 0, vacuumPsig: 0 },
    });
    expect(r.headThicknessIn).toBeCloseTo(r.shellThicknessIn * 1.15, 3);
  });

  it('includes engine version and citations', () => {
    const r = computeWallThickness({
      geometry: { orientation: 'vertical', idIn: 120, ssHeightIn: 144, freeboardIn: 12, topHead: 'F_AND_D', bottom: 'flat_ring_supported' },
      service: { specificGravity: 1.0, designTempF: 80, operatingPressurePsig: 0, vacuumPsig: 0 },
    });
    expect(r.engineVersion).toMatch(/^wall-thickness-v\d/);
    expect(r.citations).toContain('ASTM D3299');
    expect(r.citations).toContain('RTP-1 Part 3B');
  });
});
