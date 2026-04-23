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

export const TANK_TYPES: TankType[] = [
  // --- Broad vessel families -----------------------------------------------
  { id: 'frp_vessel',          label: 'FRP Vessel',                     category: 'vessel',
    description: 'Durable fiberglass-reinforced-plastic tank that will not rust or corrode, custom-designed for storing aggressive chemicals without welded seams.' },
  { id: 'asme_rtp1_vessel',    label: 'ASME RTP-1 Vessel',              category: 'vessel',
    description: 'The most comprehensive active standard for reinforced thermoset plastic equipment — fabricated to the highest quality level with controls that exceed industry norms.' },
  { id: 'process_vessel',      label: 'Process Vessel',                 category: 'vessel',
    description: 'Manufacturing equipment that keeps product in motion across refineries, food, drug, and chemical lines to complete sub-processes efficiently.' },
  { id: 'scrubber',            label: 'Scrubber',                       category: 'vessel',
    description: 'Air-pollution control system that reduces particulates and acid gases from industrial processes via wet or dry application.' },
  { id: 'mixing_tank',         label: 'Mixing Tank',                    category: 'vessel',
    description: 'Industrial-grade mixing vessel customizable with baffles, insulation, and other features to match specific agitation requirements.' },

  // --- Branded product line ------------------------------------------------
  { id: 'bryneer',             label: 'Bryneer™',                       category: 'branded',
    description: 'Fiberglass bulk salt storage and brine-making system that automatically produces saturated sodium chloride brine for industrial applications. NSF 61 listed.' },

  // --- Storage tanks, commodity & specialty --------------------------------
  { id: 'single_wall_storage', label: 'Single Wall Storage Tank',        category: 'storage',
    description: 'Common-format fiberglass tank offering efficient storage — 75% lighter than steel with a superior strength-to-weight ratio across many industries.' },
  { id: 'double_wall_storage', label: 'Double Wall Storage Tank',        category: 'storage',
    description: 'Two-wall fiberglass container providing integral secondary containment, insulation, and protection from external contamination.' },
  { id: 'brinemaker',          label: 'Brinemaker Tank',                 category: 'storage',
    description: 'Dependable, low-maintenance system that automatically produces saturated sodium chloride brine from dry salt delivered by pneumatic truck.' },
  { id: 'liquid_fertilizer',   label: 'Liquid Fertilizer Tank',          category: 'storage',
    description: 'High-quality, low-maintenance fiberglass tank designed specifically for liquid fertilizer — lightweight, durable, and easy to install.' },
  { id: 'caustic',             label: 'Caustic Tank',                    category: 'storage',
    description: 'Fiberglass tank engineered to safely store highly corrosive caustic chemicals, finished with a protective synthetic surface veil.' },
  { id: 'deionized_water',     label: 'Deionized Water Tank',            category: 'storage',
    description: 'Tank that filters ionized hard water into deionized soft water through resins — suitable for potable, plant, and industrial manufacturing use.' },
  { id: 'water',               label: 'Water Tank',                      category: 'storage',
    description: 'Durable, non-corrosive fiberglass water storage, customizable with level indicators, valves, and other fittings for a wide range of industries.' },
  { id: 'greywater',           label: 'Greywater Tank',                  category: 'storage',
    description: 'Tank designed for recycling industrial wastewater so it can be reused downstream, supporting sustainable manufacturing practices.' },
  { id: 'bleach',              label: 'Bleach Tank',                     category: 'storage',
    description: 'Corrosion-resistant fiberglass bleach storage with cost-efficient construction and safety features like tie-downs and seismic protection.' },
  { id: 'acid',                label: 'Acid Tank',                       category: 'storage',
    description: 'Corrosion-resistant fiberglass acid tank designed to safely store acidic chemicals across a wide variety of industries.' },
  { id: 'ethylene_glycol',     label: 'Ethylene Glycol Tank',            category: 'storage',
    description: 'Tank engineered to safely store ethylene glycol — an organic compound used as coolant or antifreeze in chemical and industrial applications.' },

  // --- Non-tank FRP --------------------------------------------------------
  { id: 'frp_composite',       label: 'Fiberglass Composite Structure',  category: 'composite',
    description: 'Hand lay-up nozzles, internal baffles, pipe and coil supports, agitator supports, dip pipes, ladders, lifting devices, and tie-down lugs that complement fiberglass tank systems.' },
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
  { category: 'storage',   label: 'Storage Tanks' },
  { category: 'composite', label: 'Composite Structures' },
];
