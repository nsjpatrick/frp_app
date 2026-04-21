'use client';

import { useState, useTransition } from 'react';
import { lookupSiteByAddress } from '@/lib/actions/site-lookup';

type Site = {
  indoor: boolean;
  seismic: { siteClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; Ss: number; S1: number; Ie: number; riskCategory: 'I' | 'II' | 'III' | 'IV' };
  wind: { V: number; exposure: 'B' | 'C' | 'D'; Kzt: number; riskCategory: 'I' | 'II' | 'III' | 'IV' };
};

export function SiteLookupSection({ initial, siteAddress }: { initial: Site; siteAddress: string }) {
  const [site, setSite] = useState<Site>(initial);
  const [lookupResult, setLookupResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleLookup = () => {
    startTransition(async () => {
      const r = await lookupSiteByAddress(siteAddress, site.seismic.siteClass, site.seismic.riskCategory);
      if ('error' in r) {
        setLookupResult({ ok: false, msg: r.error });
      } else {
        setSite((s) => ({ ...s, seismic: { ...s.seismic, Ss: r.seismic.Ss, S1: r.seismic.S1 } }));
        setLookupResult({ ok: true, msg: r.matchedAddress });
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-[13px] text-slate-500">
          Site address <span className="text-slate-400">(from project)</span>
          <div className="font-medium text-slate-700 text-[14px] mt-0.5">
            {siteAddress || <span className="text-slate-400">No address on project</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLookup}
          disabled={pending || !siteAddress}
          className="btn-glass text-[13px]"
        >
          {pending ? (
            <>
              <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
              Looking up…
            </>
          ) : (
            <>
              <span aria-hidden>🛰</span>
              Look up seismic from USGS
            </>
          )}
        </button>
      </div>

      {lookupResult && (
        <div
          className={`glass-chip ${lookupResult.ok ? 'glass-tinted-emerald' : ''}`}
          role="status"
          style={!lookupResult.ok ? { background: 'rgba(254, 226, 226, 0.6)', color: '#991b1b', borderColor: 'rgba(220, 38, 38, 0.35)' } : undefined}
        >
          {lookupResult.ok ? '✓' : '!'} {lookupResult.msg}
        </div>
      )}

      {/* Seismic block */}
      <div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">Seismic (ASCE 7-22)</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="glass-label">Site class</label>
            <select
              value={site.seismic.siteClass}
              onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, siteClass: e.target.value as Site['seismic']['siteClass'] } })}
              className="glass-input"
            >
              {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="glass-label">Risk cat</label>
            <select
              value={site.seismic.riskCategory}
              onChange={(e) => setSite({
                ...site,
                seismic: { ...site.seismic, riskCategory: e.target.value as Site['seismic']['riskCategory'] },
                wind: { ...site.wind, riskCategory: e.target.value as Site['wind']['riskCategory'] },
              })}
              className="glass-input"
            >
              {(['I', 'II', 'III', 'IV'] as const).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="glass-label">Ss (g)</label>
            <input
              type="number" step="any"
              value={site.seismic.Ss}
              onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, Ss: Number(e.target.value) } })}
              className="glass-input"
            />
          </div>
          <div>
            <label className="glass-label">S₁ (g)</label>
            <input
              type="number" step="any"
              value={site.seismic.S1}
              onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, S1: Number(e.target.value) } })}
              className="glass-input"
            />
          </div>
          <div>
            <label className="glass-label">I<sub>e</sub></label>
            <input
              type="number" step="any"
              value={site.seismic.Ie}
              onChange={(e) => setSite({ ...site, seismic: { ...site.seismic, Ie: Number(e.target.value) } })}
              className="glass-input"
            />
          </div>
        </div>
      </div>

      {/* Wind block */}
      <div>
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-2">Wind (ASCE 7-22)</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="glass-label">Basic wind V (mph)</label>
            <input
              type="number" step="any"
              value={site.wind.V}
              onChange={(e) => setSite({ ...site, wind: { ...site.wind, V: Number(e.target.value) } })}
              className="glass-input"
            />
          </div>
          <div>
            <label className="glass-label">Exposure</label>
            <select
              value={site.wind.exposure}
              onChange={(e) => setSite({ ...site, wind: { ...site.wind, exposure: e.target.value as Site['wind']['exposure'] } })}
              className="glass-input"
            >
              {(['B', 'C', 'D'] as const).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="glass-label">K<sub>zt</sub></label>
            <input
              type="number" step="any"
              value={site.wind.Kzt}
              onChange={(e) => setSite({ ...site, wind: { ...site.wind, Kzt: Number(e.target.value) } })}
              className="glass-input"
            />
          </div>
        </div>
      </div>

      <input type="hidden" name="siteJson" value={JSON.stringify(site)} />
    </div>
  );
}
