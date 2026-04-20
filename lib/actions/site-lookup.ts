'use server';

import { auth } from '@/lib/auth';
import { geocodeAddress, fetchUsgsSeismic } from '@/lib/site-lookup';

export type SiteLookupResult = {
  lat: number;
  lng: number;
  matchedAddress: string;
  seismic: { Ss: number; S1: number; Fa: number; Fv: number };
};

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
