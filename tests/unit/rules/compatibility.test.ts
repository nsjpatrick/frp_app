import { describe, it, expect } from 'vitest';
import { filterByChemistry } from '@/lib/rules/compatibility';
import type { SeedResin } from '@/lib/catalog/seed-data';

// Local fixture — decouples the test from the shipped SEED_RESINS catalog
// so adding new resins to the catalog doesn't require retuning expectations.
// These fixtures exercise the filter's two decision axes (chemical family +
// temperature ceiling) with predictable boundary cases.
const FIXTURE: SeedResin[] = [
  {
    id: 'a-dilute-200',
    name: 'A',
    supplier: 'X',
    family: 'vinyl_ester',
    max_service_temp_F: 200,
    density_lb_ft3: 70,
    price_per_lb: 2.5,
    compatible_chemical_families: ['dilute_acid', 'caustic'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'b-dilute-220',
    name: 'B',
    supplier: 'X',
    family: 'vinyl_ester',
    max_service_temp_F: 220,
    density_lb_ft3: 70,
    price_per_lb: 2.5,
    compatible_chemical_families: ['dilute_acid'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'c-solvent-300',
    name: 'C',
    supplier: 'X',
    family: 'novolac_epoxy_ve',
    max_service_temp_F: 300,
    density_lb_ft3: 70,
    price_per_lb: 3.5,
    compatible_chemical_families: ['solvent', 'hot_acid'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
];

describe('filterByChemistry', () => {
  it('filters to resins whose family supports the chemical and temp', () => {
    const result = filterByChemistry(FIXTURE, 'dilute_acid', 120);
    expect(result.map((r) => r.id).sort()).toEqual(['a-dilute-200', 'b-dilute-220']);
  });

  it('excludes resins below design temperature', () => {
    // Only B reaches 220°F; A tops out at 200°F; C is solvent-only.
    const result = filterByChemistry(FIXTURE, 'dilute_acid', 221);
    expect(result).toHaveLength(0);
  });

  it('boundary: design temp == max service temp still passes', () => {
    const result = filterByChemistry(FIXTURE, 'dilute_acid', 220);
    expect(result.map((r) => r.id)).toEqual(['b-dilute-220']);
  });

  it('handles unknown chemical family by returning empty', () => {
    const result = filterByChemistry(FIXTURE, 'fictional_chemical' as any, 120);
    expect(result).toHaveLength(0);
  });
});
