'use server';

import { auth } from '@/lib/auth';
import { geocodeAddress, geocodePostalCode, fetchUsgsSeismic } from '@/lib/site-lookup';

export type SiteLookupResult = {
  lat: number;
  lng: number;
  matchedAddress: string;
  seismic: { Ss: number; S1: number; Fa: number; Fv: number };
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
  return { lat: geo.lat, lng: geo.lng, matchedAddress: geo.matchedAddress, seismic };
}

/**
 * Postal-code-driven lookup. Geocodes via Zippopotam.us and then asks USGS
 * for ASCE 7-22 seismic values. USGS only covers the US + territories;
 * for international postal codes we geocode successfully but surface a
 * clear message telling the rep to enter seismic values manually.
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
  return { lat: geo.lat, lng: geo.lng, matchedAddress: geo.matchedAddress, seismic };
}
