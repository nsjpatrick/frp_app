/**
 * Anchor details — hand-curated V1 catalog of pre-qualified anchor options for
 * FRP tank attachment to concrete foundations. Capacity values are conservative
 * working-load values (no safety factors applied in the catalog — sizing algorithm
 * applies a 2.5 overall safety factor consistent with ACI 318 Ch 17).
 */

export type AnchorDetail = {
  id: string;
  boltSize: string;
  material: 'SS304' | 'SS316' | 'GALV_STEEL' | 'HAS_EPOXY';
  embedmentIn: number;
  capacityLbfEach: number;
  unitPriceUsd: number;
};

export const SEED_ANCHORS: AnchorDetail[] = [
  { id: 'ss316-5-8',  boltSize: '5/8-11 UNC',  material: 'SS316', embedmentIn: 6,  capacityLbfEach: 2_800,  unitPriceUsd: 38 },
  { id: 'ss316-3-4',  boltSize: '3/4-10 UNC',  material: 'SS316', embedmentIn: 7,  capacityLbfEach: 4_200,  unitPriceUsd: 52 },
  { id: 'ss316-7-8',  boltSize: '7/8-9 UNC',   material: 'SS316', embedmentIn: 8,  capacityLbfEach: 5_700,  unitPriceUsd: 71 },
  { id: 'ss316-1',    boltSize: '1-8 UNC',     material: 'SS316', embedmentIn: 9,  capacityLbfEach: 7_500,  unitPriceUsd: 94 },
  { id: 'ss316-1-1-4', boltSize: '1-1/4-7 UNC',material: 'SS316', embedmentIn: 11, capacityLbfEach: 11_800, unitPriceUsd: 148 },
];
