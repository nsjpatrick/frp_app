'use client';

import { useEffect, useMemo, useState } from 'react';
import { computePricing, type PricingInputs } from '@/lib/pricing/pricing-engine';
import { TickerValue } from '@/components/TickerValue';

/**
 * LiveSummary — the right-rail price preview.
 *
 * Runs the V0 pricing engine client-side so the rep sees every pricing-
 * relevant change reflected in real time — not just between saved
 * wizard steps. The server computes an initial breakdown from the
 * persisted Revision state, and any form edit on Step 1 or Step 2
 * broadcasts a `live-pricing:patch` CustomEvent via LivePricingSync.
 * We merge those patches into a local overlay and re-run
 * `computePricing` on every keystroke.
 *
 * Overlay pattern (not full replacement): we only merge the fields
 * that are present in the patch, so a Step 2 change doesn't clobber
 * persisted Step 1 values — the rep can bounce between steps and
 * the rail stays internally consistent.
 */

const NET_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'] as const;
type NetTerm = (typeof NET_TERMS)[number];

type PricingOverlay = Partial<{
  geometry: Partial<PricingInputs['geometry']>;
  service: Partial<PricingInputs['service']>;
  certs: Partial<PricingInputs['certs']>;
  wallBuildup: Partial<PricingInputs['wallBuildup']>;
}>;

export function LiveSummary({ inputs }: { inputs: PricingInputs }) {
  const [overlay, setOverlay] = useState<PricingOverlay>({});
  const [term, setTerm] = useState<NetTerm>('Net 30');

  // Listen for the unified pricing patch broadcast by `LivePricingSync`
  // (mounted inside Step 1 + Step 2 forms). Each patch is partial —
  // merge-on-top so fields the current step doesn't own aren't zeroed.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PricingOverlay>).detail;
      if (!detail) return;
      setOverlay((prev) => ({
        geometry:     { ...prev.geometry,     ...detail.geometry     },
        service:      { ...prev.service,      ...detail.service      },
        certs:        { ...prev.certs,        ...detail.certs        },
        wallBuildup:  { ...prev.wallBuildup,  ...detail.wallBuildup  },
      }));
    };
    window.addEventListener('live-pricing:patch', handler);
    return () => window.removeEventListener('live-pricing:patch', handler);
  }, []);

  const effectiveInputs: PricingInputs = useMemo(
    () => ({
      geometry:    { ...inputs.geometry,    ...overlay.geometry    },
      service:     { ...inputs.service,     ...overlay.service     },
      certs:       { ...inputs.certs,       ...overlay.certs       },
      wallBuildup: { ...inputs.wallBuildup, ...overlay.wallBuildup },
    }),
    [inputs, overlay],
  );

  const pricing = useMemo(() => computePricing(effectiveInputs), [effectiveInputs]);

  const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  return (
    <div className="space-y-4 text-[13px]">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-amber-700">
        Live Quote — V0 Pricing
      </div>

      <div className="space-y-2">
        {pricing.unitLines.map((l) => (
          <div key={l.key} className="flex items-baseline justify-between gap-3">
            <span className="text-slate-600 truncate">{l.label}</span>
            <TickerValue value={usd(l.amount)} className="font-mono text-slate-900" />
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-200/80 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500">Per vessel</span>
          <TickerValue
            value={usd(pricing.unitPrice)}
            className="font-mono text-slate-900 font-semibold"
          />
        </div>
        {pricing.quantity > 1 && (
          <div className="flex items-baseline justify-between">
            <span className="text-slate-500">× {pricing.quantity} vessels</span>
            <TickerValue
              value={usd(pricing.extendedPrice)}
              className="font-mono text-slate-900"
            />
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500">Freight</span>
          <TickerValue
            value={usd(pricing.freight)}
            className="font-mono text-slate-900"
          />
        </div>
      </div>

      <div className="pt-3 border-t-2 border-slate-300/70">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">
              Total Delivered
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">±15% until locked</div>
          </div>
          <TickerValue
            value={usd(pricing.totalDelivered)}
            className="text-[22px] font-semibold tracking-tight text-slate-900 font-mono"
            durationMs={600}
          />
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mb-2">
          Net Terms
        </div>
        <div className="flex flex-wrap gap-1.5">
          {NET_TERMS.map((t) => {
            const selected = t === term;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                aria-pressed={selected}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors border ${
                  selected
                    ? 'bg-amber-600 border-amber-700 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
