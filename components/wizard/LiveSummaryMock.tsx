'use client';

import { useState } from 'react';

/**
 * LiveSummaryMock — right-rail preview of what the live quote summary will
 * look like once the pricing engine (Plan 3) ships. Numbers are synthetic
 * and clearly labeled as a preview so no one mistakes them for real totals.
 *
 * Net-terms chips are interactive: user clicks to pick the payment terms
 * for the quote. Default is Net 30 (industry standard for FRP fab).
 *
 * Kept as opaque surfaces (not nested .glass) because the parent rail is
 * .glass — Safari drops nested backdrop-filters. Net-terms chips use
 * plain opaque Tailwind utilities rather than .glass-chip for the same
 * reason.
 */

const NET_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90'] as const;
type NetTerm = (typeof NET_TERMS)[number];

export function LiveSummaryMock() {
  const LINES: Array<[string, string]> = [
    ['Resin & Reinforcement', '$18,450'],
    ['Nozzles & Accessories', '$4,200'],
    ['Anchor & Supports',     '$1,850'],
    ['Labor',                 '$9,200'],
    ['Shop Overhead (22%)',   '$7,412'],
  ];

  const [term, setTerm] = useState<NetTerm>('Net 30');

  return (
    <div className="space-y-4 text-[13px]">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-amber-700">
        Preview — Pricing Engine Pending
      </div>

      <div className="space-y-2.5">
        {LINES.map(([label, amount]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <span className="text-slate-600 truncate">{label}</span>
            <span className="font-mono tabular-nums text-slate-900">{amount}</span>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-200/80">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-mono tabular-nums text-slate-900">$41,112</span>
        </div>
        <div className="flex items-baseline justify-between mt-1.5">
          <span className="text-slate-500">Margin (18%)</span>
          <span className="font-mono tabular-nums text-slate-900">$7,400</span>
        </div>
        <div className="flex items-baseline justify-between mt-1.5">
          <span className="text-slate-500">Freight Allow.</span>
          <span className="font-mono tabular-nums text-slate-900">$1,600</span>
        </div>
      </div>

      <div className="pt-3 border-t-2 border-slate-300/70">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">
              Quote Total
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">±15% until locked</div>
          </div>
          <div className="text-[22px] font-semibold tracking-tight text-slate-900 font-mono tabular-nums">
            $50,112
          </div>
        </div>
      </div>

      {/* Net terms — clickable chips. Opaque styling on purpose (no
          backdrop-filter) since the parent rail is .glass and Safari
          drops nested filters. */}
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

      <div className="space-y-2">
        <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 pt-2">
          Flags
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-900">
          <span className="font-semibold">Review Required.</span> 10&apos; diameter + 12&apos; SS
          requires oversize-load permit.
        </div>
      </div>
    </div>
  );
}
