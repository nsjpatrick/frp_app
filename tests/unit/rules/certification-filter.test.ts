import { describe, it, expect } from 'vitest';
import { filterByCertifications, type CertificationRequirements } from '@/lib/rules/certification-filter';
import { SEED_RESINS } from '@/lib/catalog/seed-data';

describe('filterByCertifications', () => {
  it('returns all when no requirements set', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: false,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 120);
    expect(result).toHaveLength(SEED_RESINS.length);
  });

  it('filters to NSF/ANSI 61 listed at adequate temp', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: true,
      nsf_ansi_61_target_temp_F: 150,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 150);
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(['derakane-411-350', 'hetron-922']);
  });

  it('filters further by NSF/ANSI 61 target temp above listing max', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: true,
      nsf_ansi_61_target_temp_F: 190,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 190);
    expect(result).toHaveLength(0);
  });

  it('filters by NSF/ANSI 2', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: null,
      ansi_standards: [],
      nsf_ansi_61_required: false,
      nsf_ansi_2_required: true,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 120);
    expect(result.map((r) => r.id)).toEqual(['hetron-922']);
  });

  it('filters by ASME RTP-1 class', () => {
    const reqs: CertificationRequirements = {
      asme_rtp1_class: 'III',
      ansi_standards: [],
      nsf_ansi_61_required: false,
      nsf_ansi_2_required: false,
    };
    const result = filterByCertifications(SEED_RESINS, reqs, 120);
    expect(result.map((r) => r.id).sort()).toEqual(['derakane-441-400', 'derakane-470-300']);
  });
});
