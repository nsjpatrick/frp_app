import { describe, it, expect, vi } from 'vitest';
import { fetchUsgsSeismic } from '@/lib/site-lookup/usgs-seismic';

describe('fetchUsgsSeismic', () => {
  it('parses USGS ASCE 7-22 JSON response', async () => {
    const mockResponse = {
      response: {
        data: {
          ss: 0.92,
          s1: 0.28,
          fa: 1.14,
          fv: 2.12,
          sms: 1.05,
          sm1: 0.59,
          sds: 0.70,
          sd1: 0.39,
          siteClass: 'D',
        },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse });
    vi.stubGlobal('fetch', fetchMock);

    const r = await fetchUsgsSeismic({ lat: 39.3, lng: -84.5, siteClass: 'D', riskCategory: 'II' });
    expect(r.Ss).toBeCloseTo(0.92, 2);
    expect(r.S1).toBeCloseTo(0.28, 2);
    expect(r.siteClass).toBe('D');

    vi.unstubAllGlobals();
  });

  it('throws on HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      fetchUsgsSeismic({ lat: 1, lng: 1, siteClass: 'D', riskCategory: 'II' })
    ).rejects.toThrow(/usgs/i);
    vi.unstubAllGlobals();
  });
});
