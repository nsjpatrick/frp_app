import { describe, it, expect } from 'vitest';
import { estimateWallThickness } from '@/lib/rules/wall-thickness-stub';

describe('estimateWallThickness (stub)', () => {
  it('returns thicker wall for larger diameter', () => {
    const small = estimateWallThickness({ idIn: 48, ssHeightIn: 96, specificGravity: 1.2 });
    const big = estimateWallThickness({ idIn: 144, ssHeightIn: 144, specificGravity: 1.2 });
    expect(big.shellThicknessIn).toBeGreaterThan(small.shellThicknessIn);
  });

  it('scales shell thickness with specific gravity', () => {
    const light = estimateWallThickness({ idIn: 120, ssHeightIn: 144, specificGravity: 1.0 });
    const heavy = estimateWallThickness({ idIn: 120, ssHeightIn: 144, specificGravity: 1.8 });
    expect(heavy.shellThicknessIn).toBeGreaterThan(light.shellThicknessIn);
  });

  it('flags as stub in result metadata', () => {
    const r = estimateWallThickness({ idIn: 120, ssHeightIn: 144, specificGravity: 1.4 });
    expect(r.engineVersion).toBe('wall-thickness-stub-v0');
    expect(r.governingRule).toBe('stub-lookup');
  });
});
