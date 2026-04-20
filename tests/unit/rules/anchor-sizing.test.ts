import { describe, it, expect } from 'vitest';
import { sizeAnchors } from '@/lib/rules/anchor-sizing';
import { SEED_ANCHORS } from '@/lib/catalog/anchor';

describe('sizeAnchors', () => {
  it('picks smallest anchor that satisfies uplift with 2.5x safety factor and even bolt count', () => {
    const r = sizeAnchors({ upliftLbf: 4000, catalog: SEED_ANCHORS });
    expect(r.anchorDetailId).toBe('ss316-5-8');
    expect(r.qty).toBe(4);
    expect(r.requiredCapacityLbf).toBeCloseTo(10_000, 0);
  });

  it('increments anchor size when even multiples of smaller anchors cant satisfy demand within reasonable qty', () => {
    const r = sizeAnchors({ upliftLbf: 40_000, catalog: SEED_ANCHORS });
    expect(r.qty).toBeGreaterThanOrEqual(4);
    expect(r.qty % 2).toBe(0);
    expect(r.selectedCapacityLbfEach * r.qty).toBeGreaterThanOrEqual(100_000);
  });

  it('enforces minimum of 4 anchors', () => {
    const r = sizeAnchors({ upliftLbf: 100, catalog: SEED_ANCHORS });
    expect(r.qty).toBe(4);
  });

  it('picks the most cost-effective combination (smallest total price)', () => {
    // uplift=12000 → required=30000 lbf
    // ss316-1 (7500 each, $94): ceil(30000/7500)=4 → total=$376
    // ss316-3-4 (4200 each, $52): ceil(30000/4200)=8 → total=$416
    // ss316-1 wins on cost ($376 < $416)
    const r = sizeAnchors({ upliftLbf: 12_000, catalog: SEED_ANCHORS });
    expect(r.anchorDetailId).toBe('ss316-1');
    expect(r.qty).toBe(4);
  });
});
