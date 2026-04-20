// V1 hand-curated mini catalog. Real catalog management UI arrives in Plan 6.
// Citations: Ashland Derakane Chemical Resistance Guide (2021), Hetron PPG (2020).

export type ResinCertifications = {
  nsf_ansi_61: { listed: boolean; max_temp_F?: number; listing_ref?: string };
  nsf_ansi_2: { listed: boolean; listing_ref?: string };
  asme_rtp1_class_eligibility: Array<'I' | 'II' | 'III'>;
};

export type SeedResin = {
  id: string;
  name: string;
  supplier: string;
  family: 'vinyl_ester' | 'bis_a_epoxy' | 'iso_polyester' | 'novolac';
  max_service_temp_F: number;
  density_lb_ft3: number;
  price_per_lb: number;
  compatible_chemical_families: string[];
  certifications: ResinCertifications;
};

export const SEED_RESINS: SeedResin[] = [
  {
    id: 'derakane-411-350',
    name: 'Derakane 411-350',
    supplier: 'Ashland',
    family: 'vinyl_ester',
    max_service_temp_F: 220,
    density_lb_ft3: 68,
    price_per_lb: 2.85,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'chlorinated_water', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 180, listing_ref: 'NSF 61 listing: Ashland Derakane 411-350 rev 2021' },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'derakane-441-400',
    name: 'Derakane 441-400',
    supplier: 'Ashland',
    family: 'vinyl_ester',
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
    family: 'novolac',
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
    id: 'hetron-922',
    name: 'Hetron 922',
    supplier: 'AOC',
    family: 'vinyl_ester',
    max_service_temp_F: 210,
    density_lb_ft3: 67,
    price_per_lb: 2.70,
    compatible_chemical_families: ['dilute_acid', 'caustic', 'potable_water'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 160, listing_ref: 'NSF 61 listing: AOC Hetron 922 rev 2020' },
      nsf_ansi_2: { listed: true, listing_ref: 'NSF 2 listing: AOC Hetron 922 rev 2020' },
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
