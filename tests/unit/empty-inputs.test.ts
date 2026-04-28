import { describe, expect, it } from 'vitest';
import { computePricing, type PricingInputs } from '@/lib/pricing/pricing-engine';
import { computeStepCompleteness } from '@/lib/revisions/completeness';

describe('Empty / partial inputs — progressive pricing', () => {
  it('returns $0 unitPrice when geometry is fully unset', () => {
    const inputs: PricingInputs = {
      geometry: {},
      service: {},
      certs: {},
      wallBuildup: {},
    };
    const out = computePricing(inputs);
    expect(out.unitPrice).toBe(0);
    expect(out.detail.lineItems).toHaveLength(0);
  });

  it('totalDelivered is also $0 (no freight floor) when geometry is missing', () => {
    // Per the "no price until height + diameter" product rule the engine
    // strictly returns 0 across the board — including freight — until
    // both vessel dimensions are entered. Avoids showing the rep a non-
    // zero number on a quote that has no real sizing yet.
    const out = computePricing({ geometry: {}, service: {}, certs: {}, wallBuildup: {} });
    expect(out.totalDelivered).toBe(0);
    expect(out.freight).toBe(0);
  });

  it('pricing stays at $0 with only one of diameter/SS-height set', () => {
    // The engine guard requires BOTH to engage, since either alone is
    // insufficient to compute shell area / labor / heads.
    const idOnly      = computePricing({ geometry: { idIn: 96 },             service: {}, certs: {}, wallBuildup: {} });
    const heightOnly  = computePricing({ geometry: { ssHeightIn: 144 },      service: {}, certs: {}, wallBuildup: {} });
    const sized       = computePricing({ geometry: { idIn: 96, ssHeightIn: 144 }, service: {}, certs: {}, wallBuildup: {} });
    expect(idOnly.unitPrice).toBe(0);
    expect(heightOnly.unitPrice).toBe(0);
    expect(sized.unitPrice).toBeGreaterThan(0);
    expect(sized.detail.lineItems.find((l) => l.key.startsWith('shell_fab_'))).toBeTruthy();
  });

  it('accessories alone (no geometry) stay at $0 — guard is geometry-first', () => {
    const out = computePricing({
      geometry: {
        accessories: {
          manway: { type: 'none', diameterIn: 24, rtp1Style: false },
          vents: [], dipPipes: [], blindFlanges: [],
          sightGlass: { enabled: false, sizeIn: 1 },
          tieDownLugs: { enabled: false, ratingLb: 4_000, grade: 'ss304', quantity: 0, encapsulated: false },
          liftingChannels: { enabled: false, grade: 'zinc_plated_steel', quantity: 0, encapsulated: false },
          ladder: { type: 'none', location: 'outdoor', cage: false, walkthru: false, roofturn: false },
          handrail: { type: 'none', location: 'outdoor', selfCloseGate: false },
          restPlatform: false,
          safTClimb: 'none',
          agitatorSupport: { enabled: false, encapsulated: false },
          mixerPad: false,
          splitHingedTopCover: false,
          insulation: 'none',
          plastatherm: {
            enabled: false, operatingVoltage: '120', maintainTempF: 60, minTempF: 20,
            insulationType: 'fiberglass', insulationThicknessIn: 2, safetyFactor: 0.2,
            windSpeedMph: 105, manwayInsulated: false, supportStyle: 'concrete_pad', numSupports: 0,
          },
          smartBob: 'binmaster_ao',
          nameplate: false, ventTags: false, liquidLevelIndicator: false, pipeSupportClips: 0,
          hydrotest: false,
          oAndMManuals: 0,
          peCalcs: false,
          anchorBoltTemplates: false,
          bryneerPackage: { enabled: false, breatherBag: true, kamlockCoupling: true, solenoidValve: true, flowValve: true, saltPipeStandoff: true },
        },
      },
      service: {},
      certs: {},
      wallBuildup: {},
    });
    // Accessories selected but no diameter/height → engine returns $0
    // and produces no line items (the rep can't price options against
    // a vessel that doesn't have a size yet).
    expect(out.unitPrice).toBe(0);
    expect(out.detail.lineItems).toHaveLength(0);
  });
});

describe('Step completeness — Step 1 owns Overall geometry', () => {
  function makeRev(over: Record<string, unknown> = {}) {
    return {
      revision: {
        service: { chemical: 'HCl', chemicalFamily: 'dilute_acid', operatingTempF: 80, designTempF: 120, specificGravity: 1.2 },
        certs: {},
        site: { seismic: { Ss: 0.5, S1: 0.2, siteClass: 'D', riskCategory: 'II' }, wind: { V: 110, exposure: 'C', Kzt: 1.0, riskCategory: 'II' } },
        wallBuildup: { resinId: 'derakane-signia-411' },
        geometry: { orientation: 'vertical', idIn: 96, ssHeightIn: 144, freeboardIn: 12, ...over },
      },
      quote: { totalPrice: null },
    };
  }

  it('Step 1 is incomplete when overall geometry is missing', () => {
    const r = makeRev();
    delete (r.revision.geometry as any).idIn;
    expect(computeStepCompleteness(r)['step-1']).toBe(false);
  });

  it('Step 1 is complete when chemistry + site + overall geometry are filled', () => {
    expect(computeStepCompleteness(makeRev())['step-1']).toBe(true);
  });

  it('Step 2 still requires topHead + bottom on top of Step 1', () => {
    const r = makeRev();
    expect(computeStepCompleteness(r)['step-2']).toBe(false);
    (r.revision.geometry as any).topHead = 'F_AND_D';
    (r.revision.geometry as any).bottom = 'flat_ring_supported';
    expect(computeStepCompleteness(r)['step-2']).toBe(true);
  });
});
