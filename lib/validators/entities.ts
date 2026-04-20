import { z } from 'zod';

export const customerCreateSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().max(40).optional(),
});

export const projectCreateSchema = z.object({
  customerId: z.string().cuid(),
  name: z.string().min(1).max(200),
  customerProjectNumber: z.string().max(80).optional(),
  siteAddress: z.string().max(500).optional(),
  endUse: z.string().max(500).optional(),
  needByDate: z.string().optional(),
});

export const quoteCreateSchema = z.object({
  projectId: z.string().cuid(),
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

export const geometrySchema = z.object({
  orientation: z.enum(['vertical', 'horizontal']),
  idIn: z.number().positive(),
  ssHeightIn: z.number().positive(),
  topHead: z.enum(['flat', 'F_AND_D', 'conical', 'open_top_cover']),
  bottom: z.enum(['flat_ring_supported', 'dished', 'conical_drain', 'sloped']),
  freeboardIn: z.number().nonnegative(),
});
