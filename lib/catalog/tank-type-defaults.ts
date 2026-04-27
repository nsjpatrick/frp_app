/**
 * Tank-type defaults — the snapshot of every wizard field that should be
 * pre-filled when the rep picks a given tank type on Step 1.
 *
 * Each entry mirrors a slice of `serviceConditionsSchema +
 * certificationRequirementsSchema + geometrySchema +
 * accessoriesSchema + wallBuildupSchema` so the wizard can apply them
 * with one event broadcast.  The values are sourced from PTI's typical
 * configurations as captured in jobcalc12.2.99.xls (Quote2 sheet
 * dropdowns + Bryneer notes) and the plastanks.com product pages.
 *
 * Use:
 *   import { TANK_TYPE_DEFAULTS } from '@/lib/catalog/tank-type-defaults';
 *   const defaults = TANK_TYPE_DEFAULTS[tankTypeId] ?? TANK_TYPE_DEFAULTS.frp_vessel;
 *
 * The `TankTypeDefaultsApplier` client component listens for
 * `tank-type:changed` and writes these values into the form fields so
 * downstream sections (`AccessoriesSection`, `NozzleSchedule`, etc.)
 * pick them up.
 */

import { accessoriesSchema, type Accessories } from '@/lib/validators/entities';

export type TankTypeDefaults = {
  service: {
    chemical: string;
    chemicalFamily: string;
    concentrationPct?: number;
    operatingTempF: number;
    designTempF: number;
    specificGravity: number;
    operatingPressurePsig: number;
    vacuumPsig: number;
    postCure: boolean;
  };
  certs: {
    asmeRtp1Class: 'I' | 'II' | 'III' | null;
    nsfAnsi61Required: boolean;
    nsfAnsi2Required: boolean;
    thirdPartyInspector: 'NONE' | 'TUV' | 'LLOYDS' | 'INTERTEK';
  };
  wallBuildup: {
    resinId: string;
  };
  geometry: {
    orientation: 'vertical' | 'horizontal';
    idIn: number;
    ssHeightIn: number;
    topHead: 'flat' | 'F_AND_D' | 'conical' | 'open_top_cover';
    bottom: 'flat_ring_supported' | 'dished' | 'conical_drain' | 'sloped';
    freeboardIn: number;
    baffles: boolean;
    baffleCount: number;
    baffleType: 'plate' | 'wedge';
    stainlessStand: boolean;
    nozzles: Array<{ type: string; sizeNps: string; rating: '150#' | '300#'; quantity: number }>;
  };
  accessories: Accessories;
};

/* ── Helper: empty accessory bundle (every option opt-out by default) ── */

const EMPTY_ACCESSORIES: Accessories = accessoriesSchema.parse({});

const baseFRPVessel: TankTypeDefaults = {
  service: {
    chemical: '',
    chemicalFamily: 'dilute_acid',
    operatingTempF: 80,
    designTempF: 120,
    specificGravity: 1.0,
    operatingPressurePsig: 0,
    vacuumPsig: 0,
    postCure: false,
  },
  certs: {
    asmeRtp1Class: null,
    nsfAnsi61Required: false,
    nsfAnsi2Required: false,
    thirdPartyInspector: 'NONE',
  },
  wallBuildup: { resinId: 'derakane-signia-411' },
  geometry: {
    orientation: 'vertical',
    idIn: 96,
    ssHeightIn: 144,
    topHead: 'F_AND_D',
    bottom: 'flat_ring_supported',
    freeboardIn: 12,
    baffles: false,
    baffleCount: 0,
    baffleType: 'plate',
    stainlessStand: false,
    nozzles: [],
  },
  accessories: EMPTY_ACCESSORIES,
};

/* ── Bryneer™ — branded brine-saturator package ──────────────────────
 *
 * Pulls from jobcalc Bryneer notes (Quote2!A65:B66, Labor!A188:I188,
 * 'Labor Hours'!CD2:CK9, 'Raw Materials'!B392:I427) — the SmartBob AO is
 * the standard option, salt pipe + plenum are auto-included, and NSF 61
 * is required because Bryneer is the NSF-listed potable-brine system.
 */
const bryneerDefaults: TankTypeDefaults = {
  service: {
    chemical: 'Saturated Sodium Chloride Brine',
    chemicalFamily: 'chlorinated_water',
    concentrationPct: 26, // saturated NaCl ≈ 26 wt%
    operatingTempF: 60,
    designTempF: 100,
    specificGravity: 1.20,
    operatingPressurePsig: 0,
    vacuumPsig: 0,
    postCure: false,
  },
  certs: {
    asmeRtp1Class: null,
    nsfAnsi61Required: true,   // Bryneer™ is NSF/ANSI 61 listed
    nsfAnsi2Required: false,
    thirdPartyInspector: 'NONE',
  },
  wallBuildup: { resinId: 'hetron-922' }, // NSF 61 listed VE
  geometry: {
    orientation: 'vertical',
    idIn: 120,        // 10 ft — typical Bryneer footprint
    ssHeightIn: 144,  // 12 ft — accommodates dome cover + salt cone
    topHead: 'open_top_cover', // bolt-on cover for pneumatic salt loading
    bottom: 'flat_ring_supported',
    freeboardIn: 12,
    baffles: false,
    baffleCount: 0,
    baffleType: 'plate',
    stainlessStand: false,
    nozzles: [
      { type: 'inlet',  sizeNps: '1.5"', rating: '150#', quantity: 1 }, // water inlet ring
      { type: 'outlet', sizeNps: '4"',   rating: '150#', quantity: 1 }, // brine outlet (4" 304 SS fill pipe via salt pipe)
      { type: 'drain',  sizeNps: '2"',   rating: '150#', quantity: 1 },
      { type: 'vent',   sizeNps: '8"',   rating: '150#', quantity: 1 }, // 8" pneumatic vent
    ],
  },
  accessories: {
    ...EMPTY_ACCESSORIES,
    manway: { type: 'top_hinged', diameterIn: 24, rtp1Style: false },
    vents: [{ kind: 'gooseneck', sizeIn: 8, quantity: 1 }],
    smartBob: 'binmaster_ao',
    insulation: 'none',
    nameplate: true,
    ventTags: true,
    hydrotest: false,
    oAndMManuals: 1,
    bryneerPackage: {
      enabled: true,
      breatherBag: true,
      kamlockCoupling: true,
      solenoidValve: true,
      flowValve: true,
      saltPipeStandoff: true,
    },
    // Bryneers ship with an outdoor FRP ladder + cage by default; the
    // tank typically lives outside next to a salt-truck pad.
    ladder: { type: 'frp', location: 'outdoor', cage: true, walkthru: false, roofturn: true },
    handrail: { type: 'frp', location: 'outdoor', selfCloseGate: true },
    // Most Bryneer installs are seismic-anchored; default to a 4×6,000 lb
    // 304 SS lug set so the pricing reflects realistic anchorage cost.
    tieDownLugs: { enabled: true, ratingLb: 6_000, grade: 'ss304', quantity: 4, encapsulated: false },
    // Salt-loading via pneumatic truck means the tank gets struck while
    // partially filled — a heavy-duty rest platform halfway up the ladder
    // is standard PTI practice.
    restPlatform: true,
  },
};

/* ── ASME RTP-1 vessel — defaults to Class II + third-party inspector ── */
const rtp1Defaults: TankTypeDefaults = {
  ...baseFRPVessel,
  certs: {
    asmeRtp1Class: 'II',
    nsfAnsi61Required: false,
    nsfAnsi2Required: false,
    thirdPartyInspector: 'TUV',
  },
};

/* ── Mixing tank — turns on baffles + agitator support + mixer pad ── */
const mixingTankDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  geometry: {
    ...baseFRPVessel.geometry,
    baffles: true,
    baffleCount: 4,
    baffleType: 'plate',
  },
  accessories: {
    ...EMPTY_ACCESSORIES,
    agitatorSupport: { enabled: true, encapsulated: false },
    mixerPad: true,
    splitHingedTopCover: true,
    nameplate: true,
  },
};

/* ── Scrubber — open-top with vent stack and large manway ── */
const scrubberDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  service: {
    ...baseFRPVessel.service,
    chemical: 'Acid gas scrubbing solution',
    chemicalFamily: 'oxidizing_acid',
    operatingTempF: 100,
    designTempF: 180,
  },
  wallBuildup: { resinId: 'derakane-signia-470' }, // novolac VE for hot acid
  geometry: {
    ...baseFRPVessel.geometry,
    topHead: 'open_top_cover',
  },
  accessories: {
    ...EMPTY_ACCESSORIES,
    vents: [{ kind: 'mushroom', sizeIn: 24, quantity: 1 }],
    manway: { type: 'side_flanged', diameterIn: 24, rtp1Style: false },
  },
};

/* ── Caustic — Hetron 922 + 24" side flanged manway ── */
const causticDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  service: {
    ...baseFRPVessel.service,
    chemical: 'Sodium Hydroxide (NaOH)',
    chemicalFamily: 'caustic',
    concentrationPct: 50,
    specificGravity: 1.52,
  },
  wallBuildup: { resinId: 'hetron-922' },
  accessories: {
    ...EMPTY_ACCESSORIES,
    manway: { type: 'top_hinged', diameterIn: 24, rtp1Style: false },
  },
};

/* ── Bleach (sodium hypochlorite) — 510 B-400 fire-retardant VE ─── */
const bleachDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  service: {
    ...baseFRPVessel.service,
    chemical: 'Sodium Hypochlorite (Bleach)',
    chemicalFamily: 'hypochlorite',
    concentrationPct: 12.5,
    specificGravity: 1.20,
  },
  wallBuildup: { resinId: 'derakane-510-b-400' },
  accessories: {
    ...EMPTY_ACCESSORIES,
    vents: [{ kind: 'v', sizeIn: 4, quantity: 1 }],
  },
};

/* ── Acid (general) — Derakane Signia 411 baseline ─── */
const acidDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  service: {
    ...baseFRPVessel.service,
    chemical: 'Sulfuric Acid',
    chemicalFamily: 'concentrated_acid',
    concentrationPct: 50,
    specificGravity: 1.40,
  },
  wallBuildup: { resinId: 'derakane-signia-441' },
};

/* ── Potable / DI water — Derakane 411 with NSF 61 ─── */
const waterDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  service: {
    ...baseFRPVessel.service,
    chemical: 'Potable Water',
    chemicalFamily: 'potable_water',
    specificGravity: 1.0,
  },
  certs: {
    ...baseFRPVessel.certs,
    nsfAnsi61Required: true,
  },
  wallBuildup: { resinId: 'hetron-922' },
};

/* ── Double-wall storage tank — adds secondary containment ─── */
const doubleWallDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  accessories: {
    ...EMPTY_ACCESSORIES,
    insulation: '1_layer',
    liquidLevelIndicator: true,
  },
};

/* ── Liquid fertilizer — 1.30 SG iso polyester adequate ─── */
const liquidFertilizerDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  service: {
    ...baseFRPVessel.service,
    chemical: 'Liquid Fertilizer (UAN-32)',
    chemicalFamily: 'dilute_acid',
    specificGravity: 1.32,
  },
  wallBuildup: { resinId: 'aropol-q-6376' },
};

/* ── Composite structures — minimal defaults ─── */
const compositeDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  service: { ...baseFRPVessel.service, chemical: 'Custom FRP composite' },
};

/* ── Brinemaker (legacy alias for Bryneer-class systems w/o the brand) ── */
const brinemakerDefaults: TankTypeDefaults = {
  ...bryneerDefaults,
  // Same engineering as Bryneer but without the branded SmartBob package.
  accessories: {
    ...bryneerDefaults.accessories,
    smartBob: 'none',
    bryneerPackage: { ...bryneerDefaults.accessories.bryneerPackage, enabled: false },
  },
};

/* ── Public lookup ─────────────────────────────────────────────────── */

export const TANK_TYPE_DEFAULTS: Record<string, TankTypeDefaults> = {
  frp_vessel:          baseFRPVessel,
  asme_rtp1_vessel:    rtp1Defaults,
  process_vessel:      mixingTankDefaults,
  scrubber:            scrubberDefaults,
  mixing_tank:         mixingTankDefaults,
  bryneer:             bryneerDefaults,
  single_wall_storage: baseFRPVessel,
  double_wall_storage: doubleWallDefaults,
  brinemaker:          brinemakerDefaults,
  liquid_fertilizer:   liquidFertilizerDefaults,
  caustic:             causticDefaults,
  deionized_water:     waterDefaults,
  water:               waterDefaults,
  greywater:           waterDefaults,
  bleach:              bleachDefaults,
  acid:                acidDefaults,
  ethylene_glycol:     {
    ...baseFRPVessel,
    service: {
      ...baseFRPVessel.service,
      chemical: 'Ethylene Glycol',
      chemicalFamily: 'caustic',
      specificGravity: 1.13,
      operatingTempF: 100,
      designTempF: 180,
    },
    wallBuildup: { resinId: 'derakane-signia-441' },
  },
  frp_composite: compositeDefaults,
};

export function getDefaultsForTankType(id: string | null | undefined): TankTypeDefaults {
  if (!id) return TANK_TYPE_DEFAULTS.frp_vessel;
  return TANK_TYPE_DEFAULTS[id] ?? TANK_TYPE_DEFAULTS.frp_vessel;
}
