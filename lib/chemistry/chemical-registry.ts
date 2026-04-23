import type { ChemicalFamily } from '@/lib/catalog/seed-data';

/**
 * Chemical-name → chemical-family registry.
 *
 * The configurator asks the rep two things separately:
 *   1. "Chemical" — free text (HCl, NaOH, 50% NaOCl, etc.)
 *   2. "Chemical family" — a dropdown the resin-compatibility filter
 *      actually keys off of.
 *
 * Reps reliably type the chemical name but often leave the family at its
 * default, producing wrong or no resin matches. This registry closes that
 * gap: it maps the common industrial chemicals PTI quotes every week onto
 * the right family, concentration-aware where chemistry demands it (HCl
 * < 10% is a routine dilute service; HCl > 20% is aggressive mineral
 * acid; fuming HCl is effectively a different beast).
 *
 * Citations rolled in from the Ashland Derakane Chemical Resistance Guide
 * (2021) and AOC Vipel/Hetron chemical compatibility tables.
 *
 * Extend liberally — adding an entry is free and never breaks anything:
 * unmatched chemicals just fall back to whatever the rep picked in the
 * dropdown, which is the current default behavior.
 */

export type ChemicalMatch = {
  /** The family the resin filter should key off of. */
  family: ChemicalFamily;
  /** Reader-friendly note shown next to the auto-selected family. */
  note: string;
  /** Canonical display name (unicode-subscripted). */
  display: string;
  /** If true, the chemistry is aggressive enough that post-cure is worth flagging. */
  recommendPostCure?: boolean;
};

type ConcentrationRule = {
  /** Matches if the rep's concentration_pct is in [min, max]. Both endpoints inclusive. */
  when: { minPct?: number; maxPct?: number };
  match: ChemicalMatch;
};

type RegistryEntry = {
  /** Canonical lowercase key. */
  key: string;
  /** Aliases we match against after lowercasing + stripping whitespace + unicode-desubscripting. */
  aliases: string[];
  /**
   * If concentration isn't given, use `default`. If it is, walk `byConcentration`
   * top-to-bottom and take the first rule whose range includes the value.
   * `default` is always required — it's the answer when no rule matches.
   */
  default: ChemicalMatch;
  byConcentration?: ConcentrationRule[];
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY: RegistryEntry[] = [
  // ── Mineral acids ──────────────────────────────────────────────────────
  {
    key: 'hcl',
    aliases: ['hcl', 'hydrochloric acid', 'muriatic acid'],
    default: { family: 'concentrated_acid', display: 'HCl', note: 'Hydrochloric acid — non-oxidizing mineral acid.' },
    byConcentration: [
      {
        when: { maxPct: 10 },
        match: { family: 'dilute_acid', display: 'HCl', note: 'Dilute hydrochloric acid (≤10%).' },
      },
      {
        when: { minPct: 10, maxPct: 37 },
        match: {
          family: 'concentrated_acid',
          display: 'HCl',
          note: 'Concentrated hydrochloric acid — bisphenol-A VE or chlorendic resin required.',
          recommendPostCure: true,
        },
      },
    ],
  },
  {
    key: 'h2so4',
    aliases: ['h2so4', 'sulfuric acid', 'sulphuric acid', 'oleum'],
    default: { family: 'concentrated_acid', display: 'H₂SO₄', note: 'Sulfuric acid — aggressive; note concentration.' },
    byConcentration: [
      {
        when: { maxPct: 30 },
        match: { family: 'dilute_acid', display: 'H₂SO₄', note: 'Dilute sulfuric acid (≤30%).' },
      },
      {
        when: { minPct: 30, maxPct: 75 },
        match: { family: 'concentrated_acid', display: 'H₂SO₄', note: 'Mid-range sulfuric acid (30–75%).' },
      },
      {
        when: { minPct: 75 },
        match: {
          family: 'oxidizing_acid',
          display: 'H₂SO₄',
          note: 'Concentrated sulfuric acid (>75%) behaves as an oxidizer — specialty resin required.',
          recommendPostCure: true,
        },
      },
    ],
  },
  {
    key: 'hno3',
    aliases: ['hno3', 'nitric acid'],
    default: {
      family: 'oxidizing_acid',
      display: 'HNO₃',
      note: 'Nitric acid — oxidizing; specialty resin required at any concentration.',
      recommendPostCure: true,
    },
  },
  {
    key: 'h3po4',
    aliases: ['h3po4', 'phosphoric acid'],
    default: { family: 'dilute_acid', display: 'H₃PO₄', note: 'Phosphoric acid — compatible with most VE resins.' },
    byConcentration: [
      {
        when: { minPct: 50 },
        match: { family: 'concentrated_acid', display: 'H₃PO₄', note: 'Concentrated phosphoric acid (≥50%).' },
      },
    ],
  },
  {
    key: 'hf',
    aliases: ['hf', 'hydrofluoric acid'],
    default: {
      family: 'hot_acid',
      display: 'HF',
      note: 'Hydrofluoric acid — requires specialty fluoride-grade resin. Escalate to engineering.',
      recommendPostCure: true,
    },
  },

  // ── Oxidizers / hypochlorites ─────────────────────────────────────────
  {
    key: 'naocl',
    aliases: ['naocl', 'sodium hypochlorite', 'bleach', 'hypochlorite'],
    default: {
      family: 'hypochlorite',
      display: 'NaOCl',
      note: 'Sodium hypochlorite — chlorendic or halogenated VE resin required.',
      recommendPostCure: true,
    },
  },
  {
    key: 'h2o2',
    aliases: ['h2o2', 'hydrogen peroxide'],
    default: {
      family: 'oxidizing_acid',
      display: 'H₂O₂',
      note: 'Hydrogen peroxide — oxidizer; chlorendic or novolac VE resin required.',
    },
  },
  {
    key: 'cl2',
    aliases: ['cl2', 'chlorine', 'wet chlorine'],
    default: {
      family: 'chlorinated_water',
      display: 'Cl₂',
      note: 'Chlorine — halogenated VE or chlorendic resin recommended.',
    },
  },

  // ── Caustics / bases ──────────────────────────────────────────────────
  {
    key: 'naoh',
    aliases: ['naoh', 'sodium hydroxide', 'caustic soda', 'caustic', 'lye'],
    default: { family: 'caustic', display: 'NaOH', note: 'Sodium hydroxide — VE resin with adequate corrosion barrier.' },
    byConcentration: [
      {
        when: { minPct: 50 },
        match: {
          family: 'caustic',
          display: 'NaOH',
          note: 'Concentrated caustic (≥50%) — novolac VE or elastomer-modified resin recommended.',
          recommendPostCure: true,
        },
      },
    ],
  },
  {
    key: 'koh',
    aliases: ['koh', 'potassium hydroxide', 'caustic potash'],
    default: { family: 'caustic', display: 'KOH', note: 'Potassium hydroxide — VE resin with adequate corrosion barrier.' },
  },
  {
    key: 'nh3',
    aliases: ['nh3', 'ammonia', 'aqueous ammonia', 'ammonium hydroxide', 'nh4oh'],
    default: { family: 'caustic', display: 'NH₃', note: 'Ammonia / ammonium hydroxide — caustic-class compatibility.' },
  },

  // ── Chloride salts ────────────────────────────────────────────────────
  {
    key: 'fecl3',
    aliases: ['fecl3', 'ferric chloride', 'iron(iii) chloride'],
    default: {
      family: 'dilute_acid',
      display: 'FeCl₃',
      note: 'Ferric chloride — mildly acidic salt; treat as dilute acid for resin selection.',
    },
  },
  {
    key: 'cacl2',
    aliases: ['cacl2', 'calcium chloride'],
    default: { family: 'dilute_acid', display: 'CaCl₂', note: 'Calcium chloride brine — dilute-acid compatibility.' },
  },
  {
    key: 'nacl',
    aliases: ['nacl', 'sodium chloride', 'brine', 'salt', 'salt brine', 'saturated brine'],
    default: { family: 'potable_water', display: 'NaCl', note: 'Sodium chloride brine — benign; most VE/polyester resins are fine.' },
  },

  // ── Waters ────────────────────────────────────────────────────────────
  {
    key: 'dm_water',
    aliases: ['di water', 'deionized water', 'demineralized water', 'dm water', 'ro water', 'reverse osmosis water'],
    default: { family: 'potable_water', display: 'DI Water', note: 'Deionized water — potable-class compatibility.' },
  },
  {
    key: 'potable_water',
    aliases: ['water', 'potable water', 'drinking water', 'city water'],
    default: { family: 'potable_water', display: 'Potable Water', note: 'Potable water — NSF 61 resin required for contact surfaces.' },
  },
  {
    key: 'chlorinated_water',
    aliases: ['chlorinated water', 'pool water', 'disinfected water'],
    default: { family: 'chlorinated_water', display: 'Chlorinated Water', note: 'Chlorinated water — halogenated VE or chlorendic resin.' },
  },
  {
    key: 'wastewater',
    aliases: ['wastewater', 'waste water', 'effluent', 'process water', 'greywater', 'grey water'],
    default: { family: 'potable_water', display: 'Wastewater', note: 'Wastewater service — confirm chemistry before finalizing.' },
  },

  // ── Solvents ──────────────────────────────────────────────────────────
  {
    key: 'toluene',
    aliases: ['toluene', 'methylbenzene'],
    default: {
      family: 'solvent',
      display: 'Toluene',
      note: 'Aromatic solvent — novolac VE resin required.',
      recommendPostCure: true,
    },
  },
  {
    key: 'xylene',
    aliases: ['xylene', 'dimethylbenzene'],
    default: {
      family: 'solvent',
      display: 'Xylene',
      note: 'Aromatic solvent — novolac VE resin required.',
      recommendPostCure: true,
    },
  },
  {
    key: 'acetone',
    aliases: ['acetone'],
    default: {
      family: 'solvent',
      display: 'Acetone',
      note: 'Ketone solvent — aggressive to most VE resins; confirm before quoting.',
    },
  },
  {
    key: 'methanol',
    aliases: ['methanol', 'methyl alcohol'],
    default: { family: 'solvent', display: 'Methanol', note: 'Alcohol solvent — novolac VE preferred.' },
  },
  {
    key: 'ethanol',
    aliases: ['ethanol', 'ethyl alcohol'],
    default: { family: 'solvent', display: 'Ethanol', note: 'Alcohol solvent — novolac VE preferred.' },
  },
];

// ---------------------------------------------------------------------------
// Lookup utilities
// ---------------------------------------------------------------------------

/**
 * Normalize user input for comparison: lowercase, strip whitespace, convert
 * unicode subscripts back to ASCII digits (H₂SO₄ → h2so4), strip common
 * decoration characters. Leaves hyphens/parens alone since a few aliases
 * use them.
 */
function canon(s: string): string {
  const SUB_TO_DIGIT: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  };
  return s
    .trim()
    .toLowerCase()
    .replace(/[₀-₉]/g, (d) => SUB_TO_DIGIT[d] ?? d)
    .replace(/\s+/g, ' ');
}

/**
 * Lookup a chemical by its written name/formula. Returns the best-match
 * family (concentration-aware when concentration is provided) or null if
 * nothing in the registry matches.
 *
 * Match strategy: canonicalize the input, then for each entry check if any
 * of its aliases appears as a substring of the input OR the input appears
 * as a substring of an alias. This makes "50% HCl solution" match "hcl"
 * and "sodium hypochlorite bleach" match both aliases of NaOCl.
 */
export function lookupChemical(
  rawName: string,
  concentrationPct?: number | null,
): ChemicalMatch | null {
  if (!rawName || !rawName.trim()) return null;
  const c = canon(rawName);
  const entry = REGISTRY.find((e) =>
    e.aliases.some((a) => {
      const ca = canon(a);
      return c === ca || c.includes(ca) || ca.includes(c);
    }),
  );
  if (!entry) return null;

  if (entry.byConcentration && concentrationPct != null && Number.isFinite(concentrationPct)) {
    const rule = entry.byConcentration.find((r) => {
      const { minPct, maxPct } = r.when;
      if (minPct != null && concentrationPct < minPct) return false;
      if (maxPct != null && concentrationPct > maxPct) return false;
      return true;
    });
    if (rule) return rule.match;
  }
  return entry.default;
}

/**
 * Same as `lookupChemical` but also returns whether the match is
 * concentration-aware, so the UI can prompt the rep to enter a
 * concentration for a sharper classification.
 */
export function lookupChemicalWithMeta(
  rawName: string,
  concentrationPct?: number | null,
): { match: ChemicalMatch | null; concentrationMatters: boolean } {
  const match = lookupChemical(rawName, concentrationPct);
  if (!match) return { match: null, concentrationMatters: false };
  if (!rawName) return { match, concentrationMatters: false };
  const entry = REGISTRY.find((e) =>
    e.aliases.some((a) => {
      const ca = canon(a);
      const c = canon(rawName);
      return c === ca || c.includes(ca) || ca.includes(c);
    }),
  );
  return {
    match,
    concentrationMatters: !!entry?.byConcentration && entry.byConcentration.length > 0,
  };
}
