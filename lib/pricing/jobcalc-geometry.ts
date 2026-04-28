/**
 * Geometric helpers used by the jobcalc pricing engine.
 *
 * Mirrors Labor!C570:C571 (diameter / height inputs) and the volume / area
 * formulas around row 595-650. Kept pure so unit tests can hammer them.
 */

import { GAL_PER_CUBIC_INCH, LB_PER_GAL_WATER } from './jobcalc-constants';

const PI = Math.PI;

/** Convert wizard idIn (inches) to ft. */
export function inToFt(inches: number): number {
  return inches / 12;
}

/** Cylindrical capacity in US gallons. Excel: π·r²·h ÷ 231. */
export function cylinderCapacityGal(idIn: number, ssHeightIn: number): number {
  if (idIn <= 0 || ssHeightIn <= 0) return 0;
  const volIn3 = PI * (idIn / 2) ** 2 * ssHeightIn;
  return volIn3 * GAL_PER_CUBIC_INCH;
}

/** Lateral surface area of the shell (ft²). Used for chop/resin lbs/sqft.
 * Excel uses inches throughout (Labor!E612 = π·d·h × 1.07 with 1.07 fudge),
 * but we'll work in feet here so external code stays sane.
 */
export function shellLateralAreaFt2(idIn: number, ssHeightIn: number): number {
  return (PI * inToFt(idIn) * inToFt(ssHeightIn));
}

/** Area of a flat circular head (top or bottom), ft². */
export function headAreaFt2(idIn: number): number {
  return PI * (inToFt(idIn) / 2) ** 2;
}

/**
 * Liquid weight in pounds for a vertically standing cylindrical vessel.
 * Excel: gal × (8.34 × specific gravity).  Used for both hydrotest cost
 * and Labor!T862's "Total (Full) Standing Weight" output.
 */
export function liquidWeightLb(capacityGal: number, specificGravity: number): number {
  return capacityGal * (LB_PER_GAL_WATER * specificGravity);
}

/**
 * Convert idIn (the wizard's ID in inches) to a "nominal diameter feet" the
 * Excel catalog tables key off of. Excel uses whole / half feet, so we
 * round-down to be conservative when looking up labor-hour rows.
 */
export function nominalDiameterFt(idIn: number): number {
  return Math.max(0, Math.round((idIn / 12) * 2) / 2);
}
