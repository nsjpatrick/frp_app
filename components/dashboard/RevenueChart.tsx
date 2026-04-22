/**
 * RevenueChart — inline SVG bar chart of won quote revenue per month for the
 * current calendar year. Purely presentational: receives 12 numbers and the
 * list of month labels from the server. No deps; uses the app's existing
 * Tailwind/glass palette so it stays on-brand with the rest of the UI.
 */

import { formatUSD } from '@/lib/format';

type MonthDatum = { label: string; revenue: number; count: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function RevenueChart({ data, year }: { data: MonthDatum[]; year: number }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  // Nice-number the top of the axis so ticks land on human-friendly values.
  const niceMax = niceCeil(max);
  const ticks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  const total = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalDeals = data.reduce((sum, d) => sum + d.count, 0);

  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() : -1;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-end justify-between gap-4 mb-4 shrink-0">
        <div>
          <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">
            YTD Won Revenue · {year}
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-[28px] font-semibold tracking-tight text-slate-900 tabular-nums">
              {formatUSD(total)}
            </span>
            <span className="text-[13px] text-slate-500">
              {totalDeals} {totalDeals === 1 ? 'deal' : 'deals'}
            </span>
          </div>
        </div>
      </div>

      {/* Chart body — fills whatever vertical space the parent gives. Uses
          CSS grid so bars get consistent widths without explicit math per
          column. Y-axis ticks rendered on the left. */}
      <div className="relative flex-1 min-h-[160px]">
        <div className="absolute inset-0 grid grid-cols-[auto_1fr] gap-x-3">
          {/* Y ticks */}
          <div className="flex flex-col justify-between text-[10px] text-slate-400 tabular-nums">
            {[...ticks].reverse().map((t, i) => (
              <span key={i} className="leading-none">{formatUSD(t)}</span>
            ))}
          </div>
          {/* Plot area */}
          <div className="relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {ticks.map((_, i) => (
                <div key={i} className="h-px bg-slate-200/70" />
              ))}
            </div>
            {/* Bars */}
            <div className="absolute inset-0 grid grid-cols-12 gap-2 items-end">
              {MONTHS.map((m, i) => {
                const d = data[i] ?? { label: m, revenue: 0, count: 0 };
                const pct = niceMax === 0 ? 0 : (d.revenue / niceMax) * 100;
                const isCurrent = i === currentMonth;
                const empty = d.revenue === 0;
                return (
                  <div key={m} className="relative group flex flex-col items-center h-full">
                    <div className="relative flex-1 w-full flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          isCurrent
                            ? 'bg-gradient-to-t from-amber-500 to-amber-300'
                            : empty
                            ? 'bg-slate-100/80'
                            : 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                        }`}
                        style={{ height: `${Math.max(pct, empty ? 2 : 4)}%` }}
                        aria-label={`${m} ${year}: ${formatUSD(d.revenue)} across ${d.count} wins`}
                      />
                      {/* Tooltip (CSS-only hover) */}
                      {!empty && (
                        <div
                          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ zIndex: 5 }}
                        >
                          <div className="bg-slate-900 text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap shadow-lg tabular-nums">
                            {formatUSD(d.revenue)} · {d.count} {d.count === 1 ? 'win' : 'wins'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 mt-2 shrink-0">
        <span className="w-[28px]" aria-hidden />
        <div className="grid grid-cols-12 gap-2">
          {MONTHS.map((m, i) => (
            <div
              key={m}
              className={`text-center text-[10px] font-medium tracking-wider uppercase ${
                i === currentMonth ? 'text-amber-700' : 'text-slate-500'
              }`}
            >
              {m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Round up to a human-friendly axis max (1, 2, 2.5, 5 × 10^n).
function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const exp = Math.floor(Math.log10(value));
  const base = value / Math.pow(10, exp);
  let nice: number;
  if (base <= 1) nice = 1;
  else if (base <= 2) nice = 2;
  else if (base <= 2.5) nice = 2.5;
  else if (base <= 5) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}
