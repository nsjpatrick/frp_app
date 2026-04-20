/**
 * USGS Seismic Design Maps ASCE 7-22 endpoint.
 * https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=LAT&longitude=LNG&riskCategory=II&siteClass=D&title=frp
 */

import type { SiteClass, RiskCategory } from '@/lib/rules/constants';

export async function fetchUsgsSeismic(args: {
  lat: number;
  lng: number;
  siteClass: SiteClass;
  riskCategory: RiskCategory;
}): Promise<{ Ss: number; S1: number; Fa: number; Fv: number; siteClass: SiteClass }> {
  const url = new URL('https://earthquake.usgs.gov/ws/designmaps/asce7-22.json');
  url.searchParams.set('latitude', String(args.lat));
  url.searchParams.set('longitude', String(args.lng));
  url.searchParams.set('riskCategory', args.riskCategory);
  url.searchParams.set('siteClass', args.siteClass);
  url.searchParams.set('title', 'frp-tank-quoter');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`usgs seismic lookup failed: HTTP ${res.status}`);

  const data = await res.json();
  const d = data?.response?.data;
  if (!d) throw new Error('usgs response missing data');

  return {
    Ss: d.ss,
    S1: d.s1,
    Fa: d.fa,
    Fv: d.fv,
    siteClass: args.siteClass,
  };
}
