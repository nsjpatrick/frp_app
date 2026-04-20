import { describe, it, expect, vi } from 'vitest';
import { geocodeAddress } from '@/lib/site-lookup/geocode';

describe('geocodeAddress', () => {
  it('parses Census Bureau response into { lat, lng }', async () => {
    const mockResponse = {
      result: {
        addressMatches: [
          { coordinates: { x: -84.5603, y: 39.3453 }, matchedAddress: '123 MAIN ST, FAIRFIELD, OH, 45014' },
        ],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = await geocodeAddress('123 Main St, Fairfield OH 45014');
    expect(r).toEqual({ lat: 39.3453, lng: -84.5603, matchedAddress: '123 MAIN ST, FAIRFIELD, OH, 45014' });
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it('returns null on no match', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { addressMatches: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = await geocodeAddress('nonexistent');
    expect(r).toBeNull();

    vi.unstubAllGlobals();
  });

  it('throws on HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodeAddress('anything')).rejects.toThrow(/geocode failed/i);

    vi.unstubAllGlobals();
  });
});
