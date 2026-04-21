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

export const geometrySchema = z.object({
  orientation: z.enum(['vertical', 'horizontal']),
  idIn: z.number().positive(),
  ssHeightIn: z.number().positive(),
  topHead: z.enum(['flat', 'F_AND_D', 'conical', 'open_top_cover']),
  bottom: z.enum(['flat_ring_supported', 'dished', 'conical_drain', 'sloped']),
  freeboardIn: z.number().nonnegative(),
  // Nozzle schedule — inlets, outlets, manways, vents, drains, etc.
  nozzles: z.array(nozzleSchema).default([]),
  // Interior mixing / flow baffles — common for agitated service. Count only
  // used when baffles=true; validator keeps 0 as a sentinel.
  baffles: z.boolean().default(false),
  baffleCount: z.number().int().nonnegative().default(0),
  // Stainless-steel structural stand / skirt. When stand=true, an explicit
  // grade must be chosen from the STAINLESS_GRADES tuple above.
  stainlessStand: z.boolean().default(false),
  stainlessGrade: z.enum(STAINLESS_GRADES).nullable().default(null),
});
