'use server';

import { auth } from '@/lib/auth';
import {
  geocodeAddress,
  geocodePostalCode,
  fetchUsgsSeismic,
  lookupAsceWind,
  type AsceWindLookup,
} from '@/lib/site-lookup';

export type SiteLookupResult = {
  lat: number;
  lng: number;
  matchedAddress: string;
  seismic: { Ss: number; S1: number; Fa: number; Fv: number };
  /**
   * ASCE 7-22 basic wind speed V (mph, 3-second gust) for the geocoded
   * point, adjusted to the requested risk category. `null` when the
   * lat/lng falls outside the covered zone map (typically a non-US
   * point) — the UI keeps whatever manual value the rep has there in
   * that case.
   */
  wind: AsceWindLookup | null;
};

// US territories that ASCE 7-22 seismic hazard maps cover. Anything else
// and the USGS API returns all-zeros — we flag that as unsupported rather
// than pretending the lookup succeeded.
const USGS_SUPPORTED = new Set([
  'US', 'PR', 'VI', 'GU', 'AS', 'MP',
]);

export async function lookupSiteByAddress(
  address: string,
  siteClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F',
  riskCategory: 'I' | 'II' | 'III' | 'IV',
): Promise<SiteLookupResult | { error: string }> {
  const session = await auth();
  if (!session?.user) return { error: 'unauthenticated' };

  const geo = await geocodeAddress(address);
  if (!geo) return { error: 'address not found' };

  if (siteClass === 'F') return { error: 'Site Class F requires site-specific hazard analysis' };

  const seismic = await fetchUsgsSeismic({ lat: geo.lat, lng: geo.lng, siteClass, riskCategory });
  const wind = lookupAsceWind({ lat: geo.lat, lng: geo.lng, riskCategory });
  return { lat: geo.lat, lng: geo.lng, matchedAddress: geo.matchedAddress, seismic, wind };
}

/**
 * Postal-code-driven lookup. Geocodes via Zippopotam.us, pulls ASCE 7-22
 * seismic values from USGS for the lat/lng, and looks up ASCE 7-22 wind
 * V from the local zone map. USGS seismic only covers the US + territories;
 * for international postal codes we geocode successfully but surface a
 * clear message telling the rep to enter Ss/S1 manually. Wind comes back
 * for any supported region since the zone map is self-contained.
 */
export async function lookupSiteByPostal(
  countryCode: string,
  postalCode: string,
  siteClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F',
  riskCategory: 'I' | 'II' | 'III' | 'IV',
): Promise<SiteLookupResult | { error: string; matchedAddress?: string; lat?: number; lng?: number }> {
  const session = await auth();
  if (!session?.user) return { error: 'unauthenticated' };

  if (siteClass === 'F') return { error: 'Site Class F requires site-specific hazard analysis' };

  const geo = await geocodePostalCode(countryCode, postalCode);
  if (!geo) return { error: 'Postal code not found for that country.' };

  if (!USGS_SUPPORTED.has(geo.countryCode.toUpperCase())) {
    return {
      error: `USGS hazard maps only cover the US and territories — ${geo.countryCode} needs a site-specific hazard analysis. Enter Ss/S1 manually below.`,
      matchedAddress: geo.matchedAddress,
      lat: geo.lat,
      lng: geo.lng,
    };
  }

  const seismic = await fetchUsgsSeismic({ lat: geo.lat, lng: geo.lng, siteClass, riskCategory });
  const wind = lookupAsceWind({ lat: geo.lat, lng: geo.lng, riskCategory });
  return { lat: geo.lat, lng: geo.lng, matchedAddress: geo.matchedAddress, seismic, wind };
}
