/**
 * Anchor sizing: given a required uplift force, select the cost-minimum combination of
 * anchor detail + quantity from the catalog that satisfies:
 *   qty × capacity_each ≥ uplift × safety_factor
 * with constraints:
 *   - qty ≥ 4 (practical minimum)
 *   - qty even
 *   - qty ≤ 16 per size (step up to next anchor)
 *
 * Safety factor 2.5 per ACI 318 Ch 17.
 */

import type { AnchorSizingResult } from './types';
import type { AnchorDetail } from '@/lib/catalog/anchor';

const SAFETY_FACTOR = 2.5;
const MIN_QTY = 4;
const MAX_QTY_PER_SIZE = 16;

export function sizeAnchors(input: {
  upliftLbf: number;
  catalog: AnchorDetail[];
}): AnchorSizingResult {
  const required = input.upliftLbf * SAFETY_FACTOR;

  let best: { detail: AnchorDetail; qty: number; totalCost: number } | null = null;

  for (const detail of input.catalog) {
    let qty = Math.max(MIN_QTY, Math.ceil(required / detail.capacityLbfEach));
    if (qty % 2 === 1) qty += 1;
    if (qty > MAX_QTY_PER_SIZE) continue;

    const totalCost = qty * detail.unitPriceUsd;
    if (!best || totalCost < best.totalCost) {
      best = { detail, qty, totalCost };
    }
  }

  if (!best) {
    const largest = input.catalog[input.catalog.length - 1];
    let qty = Math.max(MIN_QTY, Math.ceil(required / largest.capacityLbfEach));
    if (qty % 2 === 1) qty += 1;
    best = { detail: largest, qty, totalCost: qty * largest.unitPriceUsd };
  }

  return {
    anchorDetailId: best.detail.id,
    qty: best.qty,
    requiredCapacityLbf: +required.toFixed(1),
    selectedCapacityLbfEach: best.detail.capacityLbfEach,
    pitch: 'acceptable',
    engineVersion: 'anchor-sizing-v1',
  };
}
