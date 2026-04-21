// V1 hand-curated mini catalog. Real catalog management UI arrives in Plan 6.
// Citations: Ashland Derakane Chemical Resistance Guide (2021), Hetron PPG (2020).

export type ResinCertifications = {
  nsf_ansi_61: { listed: boolean; max_temp_F?: number; listing_ref?: string };
  nsf_ansi_2: { listed: boolean; listing_ref?: string };
  asme_rtp1_class_eligibility: Array<'I' | 'II' | 'III'>;
};

export type ResinFamily =
  | 'vinyl_ester'
  | 'bis_a_epoxy_ve'      // bisphenol-A epoxy vinyl ester (Derakane 411 lineage)
  | 'novolac_epoxy_ve'    // novolac epoxy vinyl ester (high-temp, aggressive)
  | 'iso_polyester'       // isophthalic polyester (general-purpose)
  | 'ortho_polyester'     // orthophthalic polyester (legacy, light-duty)
  | 'chlorendic_polyester'// chlorendic (HET-acid) polyester — oxidizing service
  | 'bpa_fumarate'        // bisphenol-A fumarate polyester — good acid + moderate oxidizing
  | 'elastomer_modified'; // rubber-toughened VE for mechanical/thermal cycling

export type SeedResin = {
  id: string;
  name: string;
  supplier: string;
  family: ResinFamily;
  max_service_temp_F: number;
  density_lb_ft3: number;
  price_per_lb: number;
  compatible_chemical_families: string[];
  certifications: ResinCertifications;
};

// ─── Expanded V1 catalog ────────────────────────────────────────────────────
// Hand-curated from public supplier data sheets. Prices are representative
// 2025 Q3 indicative ranges and will be replaced by live price-feed data in
// Plan 5. Citations: Ashland Derakane Chemical Resistance Guide, AOC Hetron &
// Vipel PPGs, Reichhold Dion PPGs, Polynt composites, Interplastic Silmar.
export const SEED_RESINS: SeedResin[] = [
  // ── Ashland Derakane family ────────────────────────────────────────
  {
    id: 'derakane-411-350',
    name: 'Derakane 411-350',
    supplier: 'Ashland',
    family: 'bis_a_epoxy_ve',
    max_service_temp_F: 220,
    density_lb_ft3: 68,
    price_per_lb: 2.85,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'chlorinated_water', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 180, listing_ref: 'NSF 61: Ashland Derakane 411-350' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'derakane-441-400',
    name: 'Derakane 441-400',
    supplier: 'Ashland',
    family: 'bis_a_epoxy_ve',
    max_service_temp_F: 240,
    density_lb_ft3: 69,
    price_per_lb: 3.20,
    compatible_chemical_families: ['concentrated_acid', 'oxidizing_acid', 'chlorinated_water'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
  {
    id: 'derakane-470-300',
    name: 'Derakane 470-300',
    supplier: 'Ashland',
    family: 'novolac_epoxy_ve',
    max_service_temp_F: 300,
    density_lb_ft3: 70,
    price_per_lb: 3.85,
    compatible_chemical_families: ['solvent', 'hot_acid', 'hypochlorite'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
  {
    id: 'derakane-470-HT-400',
    name: 'Derakane 470-HT-400',
    supplier: 'Ashland',
    family: 'novolac_epoxy_ve',
    max_service_temp_F: 320,
    density_lb_ft3: 70,
    price_per_lb: 4.15,
    compatible_chemical_families: ['solvent', 'hot_acid', 'oxidizing_acid', 'hypochlorite'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
  {
    id: 'derakane-510C-350',
    name: 'Derakane 510C-350',
    supplier: 'Ashland',
    family: 'bis_a_epoxy_ve',
    max_service_temp_F: 230,
    density_lb_ft3: 72,
    price_per_lb: 3.55,
    // Brominated — adds fire-retardancy; chemistry similar to 411 with
    // improved oxidizing performance.
    compatible_chemical_families: ['dilute_acid', 'concentrated_acid', 'chlorinated_water', 'hypochlorite'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'derakane-8084',
    name: 'Derakane 8084 (Elastomer-Modified)',
    supplier: 'Ashland',
    family: 'elastomer_modified',
    max_service_temp_F: 200,
    density_lb_ft3: 70,
    price_per_lb: 3.70,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'chlorinated_water', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 140, listing_ref: 'NSF 61: Ashland Derakane 8084' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },

  // ── AOC Hetron / Vipel family ──────────────────────────────────────
  {
    id: 'hetron-922',
    name: 'Hetron 922',
    supplier: 'AOC',
    family: 'bis_a_epoxy_ve',
    max_service_temp_F: 210,
    density_lb_ft3: 67,
    price_per_lb: 2.70,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 160, listing_ref: 'NSF 61: AOC Hetron 922' },
      nsf_ansi_2: { listed: true, listing_ref: 'NSF 2: AOC Hetron 922' },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'hetron-970',
    name: 'Hetron 970',
    supplier: 'AOC',
    family: 'novolac_epoxy_ve',
    max_service_temp_F: 285,
    density_lb_ft3: 69,
    price_per_lb: 3.60,
    compatible_chemical_families: ['concentrated_acid', 'oxidizing_acid', 'hot_acid', 'solvent'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
  {
    id: 'vipel-F010',
    name: 'Vipel F010 Iso Polyester',
    supplier: 'AOC',
    family: 'iso_polyester',
    max_service_temp_F: 180,
    density_lb_ft3: 72,
    price_per_lb: 2.15,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 120, listing_ref: 'NSF 61: AOC Vipel F010' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'vipel-K022',
    name: 'Vipel K022 Chlorendic',
    supplier: 'AOC',
    family: 'chlorendic_polyester',
    max_service_temp_F: 250,
    density_lb_ft3: 74,
    price_per_lb: 3.25,
    // Classic HET-acid polyester — excellent for hypochlorite + oxidizers.
    compatible_chemical_families: ['oxidizing_acid', 'hypochlorite', 'chlorinated_water', 'hot_acid'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },

  // ── Reichhold Dion family ──────────────────────────────────────────
  {
    id: 'dion-9102',
    name: 'Dion 9102 BPA Fumarate',
    supplier: 'Reichhold',
    family: 'bpa_fumarate',
    max_service_temp_F: 220,
    density_lb_ft3: 73,
    price_per_lb: 2.55,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'potable_water', 'chlorinated_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 140, listing_ref: 'NSF 61: Reichhold Dion 9102' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'dion-9300',
    name: 'Dion 9300 BPA Epoxy VE',
    supplier: 'Reichhold',
    family: 'bis_a_epoxy_ve',
    max_service_temp_F: 230,
    density_lb_ft3: 70,
    price_per_lb: 2.90,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'potable_water', 'chlorinated_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 160, listing_ref: 'NSF 61: Reichhold Dion 9300' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'dion-9400',
    name: 'Dion 9400 Chlorendic',
    supplier: 'Reichhold',
    family: 'chlorendic_polyester',
    max_service_temp_F: 240,
    density_lb_ft3: 74,
    price_per_lb: 3.10,
    compatible_chemical_families: ['oxidizing_acid', 'hypochlorite', 'chlorinated_water'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'dion-6694',
    name: 'Dion 6694 Novolac Epoxy VE',
    supplier: 'Reichhold',
    family: 'novolac_epoxy_ve',
    max_service_temp_F: 290,
    density_lb_ft3: 70,
    price_per_lb: 3.75,
    compatible_chemical_families: ['hot_acid', 'oxidizing_acid', 'solvent', 'concentrated_acid'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },

  // ── Polynt / Interplastic / Other ──────────────────────────────────
  {
    id: 'polyplex-8018',
    name: 'Polyplex 8018 Ortho Polyester',
    supplier: 'Polynt',
    family: 'ortho_polyester',
    max_service_temp_F: 160,
    density_lb_ft3: 73,
    price_per_lb: 1.85,
    // Low-cost legacy resin — good for mild-service retrofits where
    // chemistry is tolerant.
    compatible_chemical_families: ['potable_water'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I'],
    },
  },
  {
    id: 'silmar-s599',
    name: 'Silmar S-599 Iso Polyester',
    supplier: 'Interplastic',
    family: 'iso_polyester',
    max_service_temp_F: 190,
    density_lb_ft3: 72,
    price_per_lb: 2.05,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 120, listing_ref: 'NSF 61: Interplastic Silmar S-599' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'coressta-CoREZYN-VE8100',
    name: 'CoREZYN VE-8100 Vinyl Ester',
    supplier: 'Interplastic',
    family: 'bis_a_epoxy_ve',
    max_service_temp_F: 215,
    density_lb_ft3: 68,
    price_per_lb: 2.75,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'chlorinated_water', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 140, listing_ref: 'NSF 61: Interplastic CoREZYN VE-8100' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'atlac-430',
    name: 'Atlac 430 BPA Fumarate',
    supplier: 'Aliancys',
    family: 'bpa_fumarate',
    max_service_temp_F: 205,
    density_lb_ft3: 73,
    price_per_lb: 2.60,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'chlorinated_water', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'atlac-580AC',
    name: 'Atlac 580AC Novolac Epoxy VE',
    supplier: 'Aliancys',
    family: 'novolac_epoxy_ve',
    max_service_temp_F: 290,
    density_lb_ft3: 70,
    price_per_lb: 3.70,
    compatible_chemical_families: ['hot_acid', 'oxidizing_acid', 'solvent', 'hypochlorite'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
  {
    id: 'atlac-E-Nova-FW2045',
    name: 'Atlac E-Nova FW 2045',
    supplier: 'Aliancys',
    family: 'bis_a_epoxy_ve',
    max_service_temp_F: 225,
    density_lb_ft3: 70,
    price_per_lb: 3.05,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'chlorinated_water', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 160, listing_ref: 'NSF 61: Aliancys Atlac E-Nova FW 2045' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
];

export const CHEMICAL_FAMILIES = [
  'dilute_acid',
  'concentrated_acid',
  'oxidizing_acid',
  'caustic',
  'solvent',
  'hot_acid',
  'hypochlorite',
  'chlorinated_water',
  'potable_water',
] as const;

export type ChemicalFamily = typeof CHEMICAL_FAMILIES[number];

// Title-cased display labels for every chemical family. Shared between the
// Step 2 select (dropdown options) and the Review page (Service card).
export const CHEMICAL_FAMILY_LABEL: Record<ChemicalFamily, string> = {
  dilute_acid: 'Dilute Acid',
  concentrated_acid: 'Concentrated Acid',
  oxidizing_acid: 'Oxidizing Acid',
  caustic: 'Caustic',
  solvent: 'Solvent',
  hot_acid: 'Hot Acid',
  hypochlorite: 'Hypochlorite',
  chlorinated_water: 'Chlorinated Water',
  potable_water: 'Potable Water',
};

export { SEED_ANCHORS } from './anchor';
export type { AnchorDetail } from './anchor';
