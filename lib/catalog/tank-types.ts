/**
 * Tank-type catalog — the first decision a sales rep makes when starting a
 * quote. Picks the product family we're configuring. Each entry carries the
 * stable machine id (used in `revision.service.tankType` + engineering JSON),
 * a human label for the UI, and an optional short description that mirrors
 * the copy on plastanks.com's product pages.
 *
 * Descriptions are condensed from https://www.plastanks.com/our-products/*
 * so the configurator stays consistent with the marketing site without
 * cross-fetching at runtime. Keep them short (≤ 180 chars); longer context
 * belongs on the product page, not in a dropdown hint.
 */

export type TankTypeCategory = 'vessel' | 'branded' | 'storage' | 'composite';

export type TankType = {
  id: string;
  label: string;
  category: TankTypeCategory;
  description?: string;
};

// Tank-type taxonomy pared back to what jobcalc12.2.99.xls actually
// models as a distinct vessel structure — chemistry-specific aliases
// (Caustic, Bleach, Acid, Water, etc.) lived as marketing presets but
// JobCalc treats them all as the same generic FRP Storage Vessel with
// different resin / cert choices, so they're surfaced through the
// chemistry section instead of the type dropdown.
//
// Storage tanks (single-wall / double-wall) and composite structures
// were also removed — single-wall is the FRP Vessel default,
// double-wall is now a Step-1 Sidewall checkbox, and composite
// structures fold into the Accessories step rather than a top-level
// vessel type.
export const TANK_TYPES: TankType[] = [
  // --- Broad vessel families -----------------------------------------------
  { id: 'frp_vessel',          label: 'FRP Vessel',                     category: 'vessel',
    description: 'Durable fiberglass-reinforced-plastic tank that will not rust or corrode, custom-designed for storing aggressive chemicals without welded seams.' },
  { id: 'asme_rtp1_vessel',    label: 'ASME RTP-1 Vessel',              category: 'vessel',
    description: 'The most comprehensive active standard for reinforced thermoset plastic equipment — fabricated to the highest quality level with controls that exceed industry norms.' },
  { id: 'process_vessel',      label: 'Process Vessel',                 category: 'vessel',
    description: 'Manufacturing equipment that keeps product in motion across refineries, food, drug, and chemical lines — supports baffles, agitator mounts, and mixer pads.' },
  { id: 'scrubber',            label: 'Scrubber',                       category: 'vessel',
    description: 'Air-pollution control system that reduces particulates and acid gases from industrial processes via wet or dry application.' },

  // --- Branded product line ------------------------------------------------
  { id: 'bryneer',             label: 'Bryneer™',                       category: 'branded',
    description: 'Fiberglass bulk salt storage and brine-making system that automatically produces saturated sodium chloride brine for industrial applications. NSF 61 listed.' },
];

export const TANK_TYPE_BY_ID = Object.fromEntries(
  TANK_TYPES.map((t) => [t.id, t]),
) as Record<string, TankType>;

export const TANK_TYPE_IDS = TANK_TYPES.map((t) => t.id) as [string, ...string[]];

// Category ordering for grouped <optgroup>s in the dropdown.
export const TANK_TYPE_CATEGORY_ORDER: Array<{
  category: TankTypeCategory;
  label: string;
}> = [
  { category: 'vessel',    label: 'Vessels' },
  { category: 'branded',   label: 'Branded Systems' },
  // `storage` + `composite` were removed when the dropdown was scoped
  // down to vessel + Bryneer. Persisted revisions referencing those
  // category ids still resolve through `TANK_TYPE_BY_ID` lookups, which
  // ignore the category field, so no migration is needed.
];
