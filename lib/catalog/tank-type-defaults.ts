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
    /** Min ambient temperature (°F) at the install site — drives the
     *  HTD heat-loss ΔT. Defaults to 0 °F (workbook worst-case). */
    minAmbientTempF: number;
    specificGravity: number;
    operatingPressurePsig: number;
    vacuumPsig: number;
    postCure: boolean;
    installationLocation: 'indoor' | 'outdoor';
    tankColor: 'wax' | 'white' | 'grey' | 'other';
  };
  certs: {
    asmeRtp1Class: 'I' | 'II' | 'III' | null;
    nsfAnsi61Required: boolean;
    nsfAnsi2Required: boolean;
    thirdPartyInspector: 'NONE' | 'TUV' | 'LLOYDS' | 'INTERTEK';
  };
  wallBuildup: {
    resinId: string;
    /** Surface veil id from `VEIL_OPTIONS`. Defaults to "1 Ply C Glass". */
    veilId: string;
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
    /** Single (false) vs double-walled (true) sidewall. Bumps the
     *  pricing engine into Excel's "Double Wall" line items. */
    doubleWall: boolean;
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
    minAmbientTempF: 0,
    specificGravity: 1.0,
    operatingPressurePsig: 0,
    vacuumPsig: 0,
    postCure: false,
    installationLocation: 'outdoor',
    tankColor: 'wax',
  },
  certs: {
    asmeRtp1Class: null,
    nsfAnsi61Required: false,
    nsfAnsi2Required: false,
    thirdPartyInspector: 'NONE',
  },
  wallBuildup: { resinId: 'derakane-411-350', veilId: 'c_glass_1' },
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
    doubleWall: false,
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
    minAmbientTempF: 0,
    specificGravity: 1.20,
    operatingPressurePsig: 0,
    vacuumPsig: 0,
    postCure: false,
    installationLocation: 'outdoor',
    tankColor: 'white', // Bryneers ship with white gelcoat for UV
  },
  certs: {
    asmeRtp1Class: null,
    nsfAnsi61Required: true,   // Bryneer™ is NSF/ANSI 61 listed
    nsfAnsi2Required: false,
    thirdPartyInspector: 'NONE',
  },
  wallBuildup: { resinId: 'derakane-411-350', veilId: 'c_glass_1' }, // Signia 411 — NSF 61 listed VE, jobcalc active
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
    doubleWall: false,
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
    // Rest platform stays off by default — even on Bryneers, reps spec
    // it per-job rather than as a built-in.
    restPlatform: false,
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

/* ── Process Vessel — turns on baffles + agitator support + mixer pad
 * (collapsed from the legacy `mixing_tank` + `process_vessel` pair into
 * one entry per the trimmed jobcalc-derived taxonomy). ── */
const processVesselDefaults: TankTypeDefaults = {
  ...baseFRPVessel,
  geometry: {
    ...baseFRPVessel.geometry,
    baffles: true,
    baffleCount: 4,
    baffleType: 'plate',
    doubleWall: false,
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
    installationLocation: 'outdoor',
    tankColor: 'grey',
  },
  wallBuildup: { resinId: 'derakane-470-300', veilId: 'carbon_1' }, // novolac VE for hot acid + carbon for oxidizing service
  geometry: {
    ...baseFRPVessel.geometry,
    topHead: 'open_top_cover',
    doubleWall: false,
  },
  accessories: {
    ...EMPTY_ACCESSORIES,
    vents: [{ kind: 'mushroom', sizeIn: 24, quantity: 1 }],
    manway: { type: 'side_flanged', diameterIn: 24, rtp1Style: false },
  },
};

/* ── Public lookup ─────────────────────────────────────────────────── */

export const TANK_TYPE_DEFAULTS: Record<string, TankTypeDefaults> = {
  frp_vessel:       baseFRPVessel,
  asme_rtp1_vessel: rtp1Defaults,
  process_vessel:   processVesselDefaults,
  scrubber:         scrubberDefaults,
  bryneer:          bryneerDefaults,
};

// Legacy ids that older revisions may have persisted but the dropdown
// no longer surfaces. We resolve them silently to FRP Vessel via the
// fallback in `getDefaultsForTankType` so already-saved quotes never
// break — the rep just sees `FRP Vessel` selected on reload.
const _LEGACY_TANK_TYPES_REMOVED = [
  // Chemistry presets folded into the Chemistry section:
  'mixing_tank', 'single_wall_storage', 'liquid_fertilizer',
  'caustic', 'deionized_water', 'water', 'greywater',
  'bleach', 'acid', 'ethylene_glycol',
  // Storage / composite categories removed — double-wall is now a
  // Sidewall checkbox on Step 1, brinemaker collapsed into Bryneer™,
  // composite structures fold into the Accessories step.
  'double_wall_storage', 'brinemaker', 'frp_composite',
] as const;
void _LEGACY_TANK_TYPES_REMOVED;

export function getDefaultsForTankType(id: string | null | undefined): TankTypeDefaults {
  if (!id) return TANK_TYPE_DEFAULTS.frp_vessel;
  return TANK_TYPE_DEFAULTS[id] ?? TANK_TYPE_DEFAULTS.frp_vessel;
}
