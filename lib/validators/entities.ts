import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
});
export type Contact = z.infer<typeof contactSchema>;

export const customerCreateSchema = z.object({
  name: z.string().min(1).max(200),
  contacts: z.array(contactSchema).min(1),
});

export const customerUpdateSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(1).max(200),
  contacts: z.array(contactSchema).min(1),
});

// ID validators accept any non-empty string rather than strict cuid() so that
// seeded/fixture rows (IDs like `mock-proj-00-1`) pass through. Tenant-ownership
// checks in the server actions enforce authorization regardless of ID format.
export const projectCreateSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  customerProjectNumber: z.string().max(80).optional(),
  siteAddress: z.string().max(500).optional(),
  endUse: z.string().max(500).optional(),
  needByDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Need-by date must be YYYY-MM-DD').optional(),
});

export const projectUpdateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  siteAddress: z.string().max(500).optional(),
  needByDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Need-by date must be YYYY-MM-DD').optional(),
});

export const quoteCreateSchema = z.object({
  projectId: z.string().min(1),
});

export const serviceConditionsSchema = z.object({
  // Product family being quoted (FRP vessel, Bryneer, scrubber, storage…).
  // Optional for backwards compat with revisions captured before the tank-
  // type selector existed; new quotes set it on the Service step.
  tankType: z.string().min(1).optional(),
  chemical: z.string().min(1),
  chemicalFamily: z.string(),
  concentrationPct: z.number().min(0).max(100).optional(),
  operatingTempF: z.number(),
  designTempF: z.number(),
  specificGravity: z.number().positive(),
  operatingPressurePsig: z.number(),
  vacuumPsig: z.number().nonnegative(),
  // Optional thermal post-cure after layup (commonly 180–220°F / 4–8 hours)
  // to improve chemical resistance and elevated-temperature performance.
  postCure: z.boolean().default(false),
});

export const certificationRequirementsSchema = z.object({
  asmeRtp1Class: z.enum(['I', 'II', 'III']).nullable(),
  asmeRtp1StdRevision: z.string().optional(),
  ansiStandards: z.array(z.object({
    code: z.string(),
    revision: z.string(),
    scope: z.string().optional(),
  })),
  nsfAnsi61Required: z.boolean(),
  nsfAnsi61TargetTempF: z.number().optional(),
  nsfAnsi2Required: z.boolean(),
  thirdPartyInspector: z.enum(['TUV', 'LLOYDS', 'INTERTEK', 'NONE']).default('NONE'),
  requiredDocuments: z.array(z.string()),
});

export const siteEnvSchema = z.object({
  indoor: z.boolean(),
  seismic: z.object({
    siteClass: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
    Ss: z.number(),
    S1: z.number(),
    Ie: z.number(),
    riskCategory: z.enum(['I', 'II', 'III', 'IV']),
  }),
  wind: z.object({
    V: z.number(),
    exposure: z.enum(['B', 'C', 'D']),
    Kzt: z.number(),
    riskCategory: z.enum(['I', 'II', 'III', 'IV']),
  }),
  // Optional — persisted so a later edit re-seeds the postal-code input
  // instead of making the rep look it up again.
  postal: z.object({
    country: z.string().max(4),
    code:    z.string().max(20),
  }).optional(),
});

export const STAINLESS_GRADES = [
  'SS304', 'SS304L', 'SS316', 'SS316L', 'SS2205_DUPLEX', 'SS904L', 'SS321', 'SS17_4PH',
] as const;

export const NOZZLE_TYPES = [
  'inlet', 'outlet', 'manway', 'vent', 'overflow', 'drain', 'sample', 'instrument',
] as const;

export const NOZZLE_SIZES_NPS = [
  '1"', '1.5"', '2"', '3"', '4"', '6"', '8"', '10"', '12"', '16"', '20"', '24"',
  // Manway-only sizes — only selectable when nozzle type = 'manway'.
  '36"', '48"',
] as const;

export const NOZZLE_RATINGS = ['150#', '300#'] as const;

export const nozzleSchema = z.object({
  type: z.enum(NOZZLE_TYPES),
  sizeNps: z.enum(NOZZLE_SIZES_NPS),
  rating: z.enum(NOZZLE_RATINGS),
  quantity: z.number().int().min(1).max(99),
});
export type Nozzle = z.infer<typeof nozzleSchema>;

/* ── Accessories ─────────────────────────────────────────────────────
 *
 * Mirrors the named ranges in jobcalc12.2.99.xls (`couplings`, `nozzle`,
 * `manway`, `gasket`, `vvent`, `gooseneckvent`, `mushroomvent`,
 * `blindflange`, `dippipe`, `platebaffles`, `lugs`, `channels`, `ladder_*`,
 * `laddercage_*`, `walkthru_*`, `handrail_*`, `agitatorsupports`,
 * `smartbob`, `salt pipe base`). Defaults match the blank state of the
 * Quote2 sheet — every accessory is opt-in.
 */

export const TIE_DOWN_LUG_RATINGS = [2_000, 4_000, 6_000, 8_000, 12_500, 26_000] as const;
export const LUG_GRADES = ['zinc_plated_steel', 'ss304', 'ss316', 'titanium'] as const;

export const HANDRAIL_TYPES   = ['none', 'frp', 'frp_3rail', 'aluminum', 'steel'] as const;
export const LADDER_TYPES     = ['none', 'frp', 'aluminum', 'galvanized_steel'] as const;
export const LADDER_LOCATIONS = ['indoor', 'outdoor'] as const;
export const SAF_T_CLIMB      = ['none', 'standard', 'with_cage'] as const;

export const SMART_BOB        = ['none', 'binmaster_ao', 'binmaster_ao_heater', 'binmaster_sbr_ii'] as const;
export const INSULATION       = ['none', '1_layer', '2_layer'] as const;
export const VENT_KINDS       = ['gooseneck', 'mushroom', 'v'] as const;

export const ventSchema = z.object({
  kind: z.enum(VENT_KINDS),
  sizeIn: z.number().positive().max(36),
  quantity: z.number().int().min(1).max(20),
});

export const dipPipeSchema = z.object({
  diameterIn: z.number().positive().max(24),
  lengthIn: z.number().positive().max(600),
});

export const blindFlangeSchema = z.object({
  diameterIn: z.number().positive().max(48),
  material: z.enum(['frp', 'pvc']),
  quantity: z.number().int().min(1).max(20),
});

export const accessoriesSchema = z.object({
  // ─── Top access ──────────────────────────────────────────────
  manway: z.object({
    type: z.enum(['none', 'top_hinged', 'top_flanged', 'side_flanged']).default('none'),
    diameterIn: z.number().int().min(0).max(48).default(24),
    rtp1Style: z.boolean().default(false),
  }).default({ type: 'none', diameterIn: 24, rtp1Style: false }),

  // ─── Process / venting ───────────────────────────────────────
  vents: z.array(ventSchema).default([]),
  sightGlass: z.object({
    enabled: z.boolean().default(false),
    sizeIn: z.number().min(0.5).max(4).default(1),
  }).default({ enabled: false, sizeIn: 1 }),
  dipPipes: z.array(dipPipeSchema).default([]),
  blindFlanges: z.array(blindFlangeSchema).default([]),

  // ─── Anchorage ───────────────────────────────────────────────
  tieDownLugs: z.object({
    enabled: z.boolean().default(false),
    ratingLb: z.number().int().refine((n) => (TIE_DOWN_LUG_RATINGS as readonly number[]).includes(n), 'Invalid lug rating').default(4_000),
    grade: z.enum(LUG_GRADES).default('ss304'),
    quantity: z.number().int().min(0).max(64).default(0),
    encapsulated: z.boolean().default(false),
  }).default({ enabled: false, ratingLb: 4_000, grade: 'ss304', quantity: 0, encapsulated: false }),
  liftingChannels: z.object({
    enabled: z.boolean().default(false),
    grade: z.enum(LUG_GRADES).default('zinc_plated_steel'),
    quantity: z.number().int().min(0).max(8).default(0),
    encapsulated: z.boolean().default(false),
  }).default({ enabled: false, grade: 'zinc_plated_steel', quantity: 0, encapsulated: false }),

  // ─── Access (egress + service) ───────────────────────────────
  ladder: z.object({
    type: z.enum(LADDER_TYPES).default('none'),
    location: z.enum(LADDER_LOCATIONS).default('outdoor'),
    cage: z.boolean().default(false),
    walkthru: z.boolean().default(false),
    roofturn: z.boolean().default(false),
  }).default({ type: 'none', location: 'outdoor', cage: false, walkthru: false, roofturn: false }),
  handrail: z.object({
    type: z.enum(HANDRAIL_TYPES).default('none'),
    location: z.enum(LADDER_LOCATIONS).default('outdoor'),
    selfCloseGate: z.boolean().default(false),
  }).default({ type: 'none', location: 'outdoor', selfCloseGate: false }),
  restPlatform: z.boolean().default(false),
  safTClimb: z.enum(SAF_T_CLIMB).default('none'),

  // ─── Agitation / mixing ──────────────────────────────────────
  agitatorSupport: z.object({
    enabled: z.boolean().default(false),
    encapsulated: z.boolean().default(false),
  }).default({ enabled: false, encapsulated: false }),
  mixerPad: z.boolean().default(false),
  splitHingedTopCover: z.boolean().default(false),

  // ─── Insulation / heat trace ─────────────────────────────────
  insulation: z.enum(INSULATION).default('none'),
  plastatherm: z.object({
    enabled: z.boolean().default(false),
    operatingVoltage: z.enum(['120', '240', '480']).default('120'),
    maintainTempF: z.number().min(0).max(300).default(60),
    minTempF: z.number().min(-50).max(120).default(20),
  }).default({ enabled: false, operatingVoltage: '120', maintainTempF: 60, minTempF: 20 }),

  // ─── Indicators / signage ────────────────────────────────────
  smartBob: z.enum(SMART_BOB).default('none'),
  nameplate: z.boolean().default(true),
  ventTags: z.boolean().default(false),
  liquidLevelIndicator: z.boolean().default(false),
  pipeSupportClips: z.number().int().min(0).max(40).default(0),

  // ─── Documentation / QA ──────────────────────────────────────
  hydrotest: z.boolean().default(false),
  oAndMManuals: z.number().int().min(0).max(10).default(0),
  peCalcs: z.boolean().default(false),
  anchorBoltTemplates: z.boolean().default(false),

  // ─── Bryneer-specific package (auto-toggled when tankType=bryneer) ─
  bryneerPackage: z.object({
    enabled: z.boolean().default(false),
    breatherBag: z.boolean().default(true),
    kamlockCoupling: z.boolean().default(true),
    solenoidValve: z.boolean().default(true),
    flowValve: z.boolean().default(true),
    saltPipeStandoff: z.boolean().default(true),
  }).default({
    enabled: false, breatherBag: true, kamlockCoupling: true,
    solenoidValve: true, flowValve: true, saltPipeStandoff: true,
  }),
});

export type Accessories = z.infer<typeof accessoriesSchema>;

export const geometrySchema = z.object({
  orientation: z.enum(['vertical', 'horizontal']),
  idIn: z.number().positive(),
  ssHeightIn: z.number().positive(),
  topHead: z.enum(['flat', 'F_AND_D', 'conical', 'open_top_cover']),
  bottom: z.enum(['flat_ring_supported', 'dished', 'conical_drain', 'sloped']),
  freeboardIn: z.number().nonnegative(),
  // Number of identical vessels on this quote. Multiplies pricing + shows
  // a "Vessels (×N)" line item in the PDF / email when > 1. Default 1 so
  // legacy revisions saved before this field existed keep rendering.
  quantity: z.number().int().min(1).max(99).default(1),
  // Nozzle schedule — inlets, outlets, manways, vents, drains, etc.
  nozzles: z.array(nozzleSchema).default([]),
  // Interior mixing / flow baffles — common for agitated service. Count only
  // used when baffles=true; validator keeps 0 as a sentinel.
  baffles: z.boolean().default(false),
  baffleCount: z.number().int().nonnegative().default(0),
  baffleType: z.enum(['plate', 'wedge']).default('plate'),
  // Stainless-steel structural stand / skirt. When stand=true, an explicit
  // grade must be chosen from the STAINLESS_GRADES tuple above.
  stainlessStand: z.boolean().default(false),
  stainlessGrade: z.enum(STAINLESS_GRADES).nullable().default(null),
  // Full accessory schedule — defaults to all-off so legacy revisions
  // saved before this field existed keep rendering.
  accessories: accessoriesSchema.default(accessoriesSchema.parse({})),
});
