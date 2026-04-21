import { describe, it, expect } from 'vitest';
import { filterByCertifications, type CertificationRequirements } from '@/lib/rules/certification-filter';
import type { SeedResin } from '@/lib/catalog/seed-data';

// Local fixture — decouples the test from the shipped SEED_RESINS catalog.
// Mix of certifications so each filter axis has a pass + fail case.
const FIXTURE: SeedResin[] = [
  {
    id: 'a-nsf61-180',
    name: 'A',
    supplier: 'X',
    family: 'vinyl_ester',
    max_service_temp_F: 220,
    density_lb_ft3: 70,
    price_per_lb: 2.5,
    compatible_chemical_families: ['dilute_acid'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 180 },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'b-nsf61-160-nsf2',
    name: 'B',
    supplier: 'X',
    family: 'vinyl_ester',
    max_service_temp_F: 210,
    density_lb_ft3: 70,
    price_per_lb: 2.5,
    compatible_chemical_families: ['dilute_acid'],
    certifications: {
      nsf_ansi_61: { listed: true, max_temp_F: 160 },
      nsf_ansi_2: { listed: true },
      asme_rtp1_class_eligibility: ['I', 'II'],
    },
  },
  {
    id: 'c-rtp1-iii',
    name: 'C',
    supplier: 'X',
    family: 'novolac_epoxy_ve',
    max_service_temp_F: 300,
    density_lb_ft3: 70,
    price_per_lb: 3.5,
    compatible_chemical_families: ['solvent'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
  {
    id: 'd-rtp1-iii-only',
    name: 'D',
    supplier: 'X',
    family: 'novolac_epoxy_ve',
    max_service_temp_F: 320,
    density_lb_ft3: 70,
    price_per_lb: 4,
    compatible_chemical_families: ['oxidizing_acid'],
    certifications: {
      nsf_ansi_61: { listed: false },
      nsf_ansi_2: { listed: false },
      asme_rtp1_class_eligibility: ['I', 'II', 'III'],
    },
  },
];

describe('filterByCertifications', () => {
  it('returns all when no requirements set', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: false,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(FIXTURE, reqs, 120);
    expect(result).toHaveLength(FIXTURE.length);
  });

  it('filters to NSF/ANSI 61 listed at adequate temp', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: true,
      nsf_ansi_61_target_temp_F: 150,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(FIXTURE, reqs, 150);
    // A (max 180°F) and B (max 160°F) both satisfy 150°F target.
    expect(result.map((r) => r.id).sort()).toEqual(['a-nsf61-180', 'b-nsf61-160-nsf2']);
  });

  it('filters further by NSF/ANSI 61 target temp above listing max', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: true,
      nsf_ansi_61_target_temp_F: 190,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(FIXTURE, reqs, 190);
    expect(result).toHaveLength(0);
  });

  it('filters by NSF/ANSI 2', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: false,
      nsf_ansi_2_required: true,
    };
    const result = filterByCertifications(FIXTURE, reqs, 120);
    expect(result.map((r) => r.id)).toEqual(['b-nsf61-160-nsf2']);
  });

  it('filters by ASME RTP-1 class', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: 'III',
      ansi_standards: [],
      nsf_ansi_61_required: false,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(FIXTURE, reqs, 120);
    expect(result.map((r) => r.id).sort()).toEqual(['c-rtp1-iii', 'd-rtp1-iii-only']);
  });
});
