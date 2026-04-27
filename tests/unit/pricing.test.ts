import { describe, expect, it } from 'vitest';
import { computePricing, type PricingInputs } from '@/lib/pricing/pricing-engine';
import {
  BURDENED_LABOR_RATE_PER_HR,
  SALES_MODIFIER,
} from '@/lib/pricing/jobcalc-constants';
import { rollup, emptyLine } from '@/lib/pricing/jobcalc-engine';

const baseInputs: PricingInputs = {
  geometry: {
    orientation: 'vertical',
    idIn: 96,           // 8 ft
    ssHeightIn: 144,    // 12 ft
    nozzles: [
      { type: 'inlet', sizeNps: '4"', rating: '150#', quantity: 1 },
      { type: 'outlet', sizeNps: '6"', rating: '150#', quantity: 1 },
      { type: 'vent', sizeNps: '2"', rating: '150#', quantity: 1 },
    ],
    baffles: false,
    baffleCount: 0,
    stainlessStand: false,
    stainlessGrade: null,
    quantity: 1,
  },
  service: {
    postCure: false,
    specificGravity: 1.20,
    operatingPressurePsig: 0,
  },
  certs: {
    asmeRtp1Class: null,
    nsfAnsi61Required: false,
    nsfAnsi2Required: false,
    thirdPartyInspector: 'NONE',
  },
  wallBuildup: { resinId: 'derakane-signia-411' },
};

describe('jobcalc rollup math', () => {
  it('matches Excel labor formula: hrs × $71.5/hr', () => {
    const r = rollup(
      [{
        ...emptyLine('test', 'test', 'flat'),
        fittingsHrs: 10, // 1.0 × 1.0 efficiency = 10 hrs
      }],
      4.40,
    );
    expect(r.totalAdjustedLaborHrs).toBeCloseTo(10, 5);
    expect(r.laborAmountUsd).toBeCloseTo(10 * BURDENED_LABOR_RATE_PER_HR, 2);
    expect(BURDENED_LABOR_RATE_PER_HR).toBe(71.5);
  });

  it('applies category efficiency multipliers (Shell Fab 1.15, Finishing 0.75)', () => {
    const r = rollup(
      [{ ...emptyLine('a', 'a', 'flat'), shellFabHrs: 10 }],
      4.40,
    );
    expect(r.totalAdjustedLaborHrs).toBeCloseTo(11.5, 5); // 10 × 1.15

    const r2 = rollup(
      [{ ...emptyLine('b', 'b', 'flat'), finishingHrs: 10 }],
      4.40,
    );
    expect(r2.totalAdjustedLaborHrs).toBeCloseTo(7.5, 5); // 10 × 0.75
  });

  it('zeros out indirect labor (efficiency × 0)', () => {
    const r = rollup(
      [{ ...emptyLine('a', 'a', 'flat'), indirectHrs: 100 }],
      4.40,
    );
    expect(r.totalAdjustedLaborHrs).toBe(0);
  });

  it('applies sales modifier 0.38 → unitPrice = cost ÷ 0.38', () => {
    const r = rollup(
      [{ ...emptyLine('a', 'a', 'flat'), buyoutsUsd: 1_000 }],
      4.40,
    );
    expect(r.grandTankCostUsd).toBe(1_000);
    expect(r.unitSalePriceUsd).toBeCloseTo(1_000 / SALES_MODIFIER, 2);
  });
});

describe('computePricing — public API', () => {
  it('returns the V0-compatible breakdown shape', () => {
    const out = computePricing(baseInputs);
    expect(out).toHaveProperty('unitPrice');
    expect(out).toHaveProperty('unitLines');
    expect(out).toHaveProperty('quantity', 1);
    expect(out).toHaveProperty('extendedPrice');
    expect(out).toHaveProperty('freight');
    expect(out).toHaveProperty('totalDelivered');
    expect(out.unitLines).toBeInstanceOf(Array);
    expect(out.totalDelivered).toBeCloseTo(out.extendedPrice + out.freight, 2);
  });

  it('produces a sensible price for a typical 8×12 ft vessel', () => {
    const out = computePricing(baseInputs);
    // 8'×12' Derakane VE tank with 3 fittings — expected to land in the
    // $20k–$120k range across the cost-to-price spread; if it falls
    // outside this band something major has shifted in the catalog.
    expect(out.unitPrice).toBeGreaterThan(15_000);
    expect(out.unitPrice).toBeLessThan(200_000);
  });

  it('quantity multiplies extendedPrice', () => {
    const out = computePricing({
      ...baseInputs,
      geometry: { ...baseInputs.geometry, quantity: 3 },
    });
    expect(out.quantity).toBe(3);
    expect(out.extendedPrice).toBeCloseTo(out.unitPrice * 3, 1);
  });

  it('a more expensive resin raises the price', () => {
    const cheap = computePricing(baseInputs);
    const dear = computePricing({
      ...baseInputs,
      wallBuildup: { resinId: 'derakane-signia-470' }, // $6.25 vs $4.40
    });
    expect(dear.unitPrice).toBeGreaterThan(cheap.unitPrice);
  });

  it('horizontal orientation swaps ring-stand for saddles', () => {
    const v = computePricing(baseInputs);
    const h = computePricing({
      ...baseInputs,
      geometry: { ...baseInputs.geometry, orientation: 'horizontal' },
    });
    // Horizontal: saddles, no ring stand. Vertical: ring stand, no saddles.
    expect(h.detail.lineItems.some((l) => l.key === 'saddles_horiz')).toBe(true);
    expect(h.detail.lineItems.some((l) => l.key === 'ring_stand')).toBe(false);
    expect(v.detail.lineItems.some((l) => l.key === 'ring_stand')).toBe(true);
    expect(v.detail.lineItems.some((l) => l.key === 'saddles_horiz')).toBe(false);
  });

  it('certifications add premium rep-facing line items', () => {
    const out = computePricing({
      ...baseInputs,
      certs: { ...baseInputs.certs, asmeRtp1Class: 'II', nsfAnsi61Required: true },
    });
    const labels = out.unitLines.map((l) => l.key);
    expect(labels).toContain('asme_rtp1');
    expect(labels).toContain('nsf61');
  });

  it('post-cure adds a tests line item', () => {
    const out = computePricing({
      ...baseInputs,
      service: { ...baseInputs.service, postCure: true },
    });
    expect(out.detail.lineItems.find((l) => l.key === 'post_cure')).toBeTruthy();
  });

  it('exposes Excel-style detail (labor + material amounts, line items)', () => {
    const out = computePricing(baseInputs);
    expect(out.detail.laborAmountUsd).toBeGreaterThan(0);
    expect(out.detail.materialAmountUsd).toBeGreaterThan(0);
    expect(out.detail.grandTankCostUsd).toBeCloseTo(
      out.detail.laborAmountUsd + out.detail.materialAmountUsd,
      0,
    );
    // Sale price and grand-cost should differ by the sales-modifier uplift.
    expect(out.unitPrice).toBeGreaterThan(out.detail.grandTankCostUsd);
    // Line items list non-empty for a configured tank.
    expect(out.detail.lineItems.length).toBeGreaterThan(0);
  });
});
