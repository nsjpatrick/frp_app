/**
 * Structural analysis constants. Sources:
 * - ASCE 7-22 §26.6 (directionality), Table 1.5-2 (importance), §11.4 (site coefficients)
 * - RTP-1 Part 3B Table 3B-2 (FRP allowable design stresses)
 * - ASTM D3299 §8 (hoop design stress basis)
 */

export const WIND_DIRECTIONALITY_Kd_ROUND_TANK = 0.95; // ASCE 7-22 Table 26.6-1

export type RiskCategory = 'I' | 'II' | 'III' | 'IV';

export const IMPORTANCE_FACTOR: Record<RiskCategory, { Iw: number; Ie: number }> = {
  I:   { Iw: 0.87, Ie: 1.00 },
  II:  { Iw: 1.00, Ie: 1.00 },
  III: { Iw: 1.15, Ie: 1.25 },
  IV:  { Iw: 1.15, Ie: 1.50 },
};

export type SiteClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * Fa lookup per ASCE 7-22 Table 11.4-1 (short-period site coefficient).
 * Keys are Ss thresholds; value is a row of Fa by site class.
 * Linear interpolation between table rows.
 */
export const FA_TABLE: Record<number, Partial<Record<SiteClass, number>>> = {
  0.25: { A: 0.8, B: 0.9, C: 1.3, D: 1.6, E: 2.4 },
  0.50: { A: 0.8, B: 0.9, C: 1.3, D: 1.4, E: 1.7 },
  0.75: { A: 0.8, B: 0.9, C: 1.2, D: 1.2, E: 1.3 },
  1.00: { A: 0.8, B: 0.9, C: 1.2, D: 1.1, E: 1.1 },
  1.25: { A: 0.8, B: 0.9, C: 1.2, D: 1.0, E: 0.9 },
  1.50: { A: 0.8, B: 0.9, C: 1.2, D: 1.0, E: 0.8 },
};

/**
 * Fv lookup per ASCE 7-22 Table 11.4-2 (long-period site coefficient).
 */
export const FV_TABLE: Record<number, Partial<Record<SiteClass, number>>> = {
  0.10: { A: 0.8, B: 0.8, C: 1.5, D: 2.4, E: 4.2 },
  0.20: { A: 0.8, B: 0.8, C: 1.5, D: 2.2, E: 3.3 },
  0.30: { A: 0.8, B: 0.8, C: 1.5, D: 2.0, E: 2.8 },
  0.40: { A: 0.8, B: 0.8, C: 1.5, D: 1.9, E: 2.4 },
  0.50: { A: 0.8, B: 0.8, C: 1.5, D: 1.8, E: 2.2 },
  0.60: { A: 0.8, B: 0.8, C: 1.4, D: 1.7, E: 2.0 },
};

/**
 * RTP-1 Part 3B allowable hoop design stress for standard FRP laminates.
 * Conservative V1 default; real project can override per the specified resin system's data sheet.
 */
export const RTP1_HOOP_DESIGN_STRESS_PSI = 1500;

/**
 * ASTM D3299 §8.1 factor accounting for combined hoop + hydrostatic head.
 */
export const D3299_AXIAL_TO_HOOP_THICKNESS_RATIO = 0.5;

/**
 * RTP-1 Part 3B Table 3B-1 minimum shell thickness (inches) as a function of diameter.
 * Piecewise: min of (D/480, 0.1875") for typical diameters.
 */
export function rtp1MinimumShellThicknessIn(diameterIn: number): number {
  const computed = diameterIn / 480;
  return Math.max(computed, 0.1875);
}

export const FT_PER_IN = 1 / 12;
export const IN_PER_FT = 12;
export const WATER_DENSITY_PCF = 62.4;
export const GRAVITY_IN_PER_SEC2 = 386.4;
