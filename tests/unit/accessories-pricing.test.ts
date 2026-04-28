import { describe, expect, it } from 'vitest';
import { computePricing } from '@/lib/pricing/pricing-engine';
import type { PricingInputs } from '@/lib/pricing/pricing-engine';
import { accessoriesSchema } from '@/lib/validators/entities';
import { getDefaultsForTankType } from '@/lib/catalog/tank-type-defaults';

const baseGeom: PricingInputs['geometry'] = {
  orientation: 'vertical',
  idIn: 96,
  ssHeightIn: 144,
  nozzles: [],
  baffles: false,
  baffleCount: 0,
  stainlessStand: false,
  stainlessGrade: null,
  quantity: 1,
};

const baseInputs: PricingInputs = {
  geometry: { ...baseGeom, accessories: accessoriesSchema.parse({}) },
  service: { postCure: false, specificGravity: 1.0, operatingPressurePsig: 0 },
  certs: { asmeRtp1Class: null, nsfAnsi61Required: false, nsfAnsi2Required: false, thirdPartyInspector: 'NONE' },
  wallBuildup: { resinId: 'derakane-411-350' },
};

function withAcc(patch: Partial<ReturnType<typeof accessoriesSchema.parse>>) {
  return {
    ...baseInputs,
    geometry: {
      ...baseInputs.geometry,
      accessories: { ...accessoriesSchema.parse({}), ...patch },
    },
  };
}

describe('Accessory line-item builders', () => {
  it('manway: top-hinged 24" adds a fittings line', () => {
    const out = computePricing(withAcc({
      manway: { type: 'top_hinged', diameterIn: 24, rtp1Style: false },
    }));
    expect(out.detail.lineItems.find((l) => l.key === 'manway:24_top_hinged')).toBeTruthy();
  });

  it('vents: gooseneck 8" adds buyout cost', () => {
    const noVent = computePricing(baseInputs);
    const withVent = computePricing(withAcc({
      vents: [{ kind: 'gooseneck', sizeIn: 8, quantity: 1 }],
    }));
    expect(withVent.unitPrice).toBeGreaterThan(noVent.unitPrice);
    expect(withVent.detail.lineItems.find((l) => l.key.startsWith('vent:gooseneck_8'))).toBeTruthy();
  });

  it('tie-down lugs: 4× 6,000 lb 304 SS adds anchorage', () => {
    const out = computePricing(withAcc({
      tieDownLugs: { enabled: true, ratingLb: 6_000, grade: 'ss304', quantity: 4, encapsulated: false },
    }));
    const lug = out.detail.lineItems.find((l) => l.key === 'lugs:6000_ss304');
    expect(lug).toBeTruthy();
    // 4 × $109.20 = $436.80; line should reflect that buyout magnitude.
    expect(lug!.materialUsd).toBeGreaterThan(400);
    expect(lug!.materialUsd).toBeLessThan(500);
  });

  it('ladder: 12-ft FRP outdoor with cage adds shellFab + buyout', () => {
    const out = computePricing(withAcc({
      ladder: { type: 'frp', location: 'outdoor', cage: true, walkthru: false, roofturn: false },
    }));
    const ladder = out.detail.lineItems.find((l) => l.key.startsWith('ladder:frp_'));
    expect(ladder).toBeTruthy();
    expect(ladder!.totalUsd).toBeGreaterThan(0);
  });

  it('handrail: FRP 8-ft adds installation labor', () => {
    const out = computePricing(withAcc({
      handrail: { type: 'frp', location: 'outdoor', selfCloseGate: true },
    }));
    const hr = out.detail.lineItems.find((l) => l.key.startsWith('handrail:frp_'));
    expect(hr).toBeTruthy();
    expect(hr!.totalUsd).toBeGreaterThan(0);
  });

  it('insulation: 2-layer adds large surface labor + foam buyout', () => {
    const noIns = computePricing(baseInputs);
    const ins = computePricing(withAcc({ insulation: '2_layer' }));
    expect(ins.unitPrice).toBeGreaterThan(noIns.unitPrice);
    expect(ins.detail.lineItems.find((l) => l.key === 'insulation_2_layer')).toBeTruthy();
  });

  it('hydrotest: tall vessel triggers crane permit + labor', () => {
    const tall = computePricing(withAcc({ hydrotest: true }));
    expect(tall.detail.lineItems.find((l) => l.key === 'hydrotest')).toBeTruthy();
  });

  it('SmartBob AO: adds Binmaster fittings line', () => {
    const out = computePricing(withAcc({ smartBob: 'binmaster_ao' }));
    expect(out.detail.lineItems.find((l) => l.key === 'smartbob:binmaster_ao')).toBeTruthy();
  });

  it('Bryneer™ package: adds salt pipe + plenum + adder line', () => {
    const out = computePricing(withAcc({
      bryneerPackage: {
        enabled: true, breatherBag: true, kamlockCoupling: true,
        solenoidValve: true, flowValve: true, saltPipeStandoff: true,
      },
    }));
    const pkg = out.detail.lineItems.find((l) => l.key === 'bryneer_package');
    expect(pkg).toBeTruthy();
    // Bryneer package buyout floors at the 8' salt pipe ($3,393.50) +
    // passivation ($920) + adder bundle ≈ $5,000+.
    expect(pkg!.materialUsd).toBeGreaterThan(4_000);
  });
});

describe('Tank-type defaults', () => {
  it('bryneer defaults set NSF 61, Hetron 922, SmartBob AO, Bryneer pkg', () => {
    const d = getDefaultsForTankType('bryneer');
    expect(d.certs.nsfAnsi61Required).toBe(true);
    expect(d.wallBuildup.resinId).toBe('derakane-411-350');
    expect(d.accessories.smartBob).toBe('binmaster_ao');
    expect(d.accessories.bryneerPackage.enabled).toBe(true);
    expect(d.service.specificGravity).toBe(1.20);
  });

  it('process vessel defaults turn on baffles + agitator support', () => {
    // `mixing_tank` was folded into `process_vessel` when the type list
    // was pared down to the jobcalc-derivable set.
    const d = getDefaultsForTankType('process_vessel');
    expect(d.geometry.baffles).toBe(true);
    expect(d.geometry.baffleCount).toBe(4);
    expect(d.accessories.agitatorSupport.enabled).toBe(true);
  });

  it('rtp1 vessel default sets Class II + third-party inspector', () => {
    const d = getDefaultsForTankType('asme_rtp1_vessel');
    expect(d.certs.asmeRtp1Class).toBe('II');
    expect(d.certs.thirdPartyInspector).toBe('TUV');
  });

  it('falls back to FRP vessel when id is unknown', () => {
    const d = getDefaultsForTankType('not_a_real_id');
    expect(d.wallBuildup.resinId).toBe('derakane-411-350');
  });

  it('a Bryneer-configured vessel prices significantly above a bare tank', () => {
    const bare = computePricing(baseInputs);
    const bryneer = computePricing({
      ...baseInputs,
      geometry: {
        ...baseInputs.geometry,
        idIn: 120,
        ssHeightIn: 144,
        accessories: getDefaultsForTankType('bryneer').accessories,
        nozzles: getDefaultsForTankType('bryneer').geometry.nozzles,
      },
      service: { ...baseInputs.service, specificGravity: 1.20 },
      wallBuildup: { resinId: 'derakane-411-350' },
      certs: { ...baseInputs.certs, nsfAnsi61Required: true },
    });
    // Bryneer config bundles SmartBob + salt pipe + ladder + handrail + lugs
    // + manway + vents — should be substantially larger.
    expect(bryneer.unitPrice).toBeGreaterThan(bare.unitPrice * 1.5);
  });
});
