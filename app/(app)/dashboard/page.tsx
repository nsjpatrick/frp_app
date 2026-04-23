import Link from 'next/link';
import { Plus, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { formatFormula, formatUSD } from '@/lib/format';
import { RevenueChart } from '@/components/dashboard/RevenueChart';

const STATUS_STYLE: Record<string, string> = {
  DRAFT:        'glass-chip',
  SENT:         'glass-chip glass-tinted-slate',
  ENGINEERING:  'glass-chip glass-tinted-amber',
  BUILDING:     'glass-chip bg-sky-100/70 text-sky-900 border-sky-300/50',
  WON:          'glass-chip glass-tinted-emerald',
  SHIPPED:      'glass-chip glass-tinted-emerald',
  LOST:         'glass-chip glass-tinted-rose',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ENGINEERING: 'Engineering',
  BUILDING: 'Fabricating',
  WON: 'Won',
  SHIPPED: 'Shipped',
  LOST: 'Lost',
};

export default async function Dashboard() {
  const session = await auth();
  const user = session?.user as any;

  // Scope on Quote.customer directly now that quotes can be project-less.
  // Going through project.customer would silently drop any quote without
  // a project.
  const tenantScope = { customer: { tenantId: user.tenantId } } as const;

  // Year-to-date window starts Jan 1 of the current year. `wonAt` is the
  // transition timestamp we stamp on status→WON, so grouping by that column
  // (not createdAt) gives us revenue attributed to the month it closed.
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const [wonYtd, recent, openCount] = await Promise.all([
    db.quote.findMany({
      where: {
        ...tenantScope,
        // WON and SHIPPED both count as closed revenue — a shipped tank
        // is still a won deal, just further downstream.
        status: { in: ['WON', 'SHIPPED'] },
        wonAt: { gte: yearStart, lt: yearEnd },
        totalPrice: { not: null },
      },
      select: { totalPrice: true, wonAt: true },
    }),
    db.quote.findMany({
      where: tenantScope,
      include: {
        // Customer is always present; project is optional — pull both so the
        // row can render with a graceful "No project" fallback.
        customer: true,
        project: true,
        revisions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    db.quote.count({
      where: {
        ...tenantScope,
        // Open pipeline = anything pre-terminal. BUILDING is the
        // fabrication state (display label "Fabricating").
        status: { in: ['SENT', 'ENGINEERING', 'BUILDING'] },
      },
    }),
  ]);

  const monthData = Array.from({ length: 12 }, (_, i) => ({
    label: new Date(year, i, 1).toLocaleString(undefined, { month: 'short' }),
    revenue: 0,
    count: 0,
  }));
  let ytdTotal = 0;
  for (const q of wonYtd) {
    if (!q.wonAt || q.totalPrice == null) continue;
    const m = new Date(q.wonAt).getMonth();
    monthData[m].revenue += q.totalPrice;
    monthData[m].count += 1;
    ytdTotal += q.totalPrice;
  }
  const wonCount = wonYtd.length;
  const avgDeal = wonCount > 0 ? ytdTotal / wonCount : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header + search */}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <div className="flex items-center gap-3 flex-1 justify-end">
          <form action="/quotes" method="get" className="relative flex-1 max-w-[560px]">
            <input
              type="search"
              name="q"
              placeholder="Search quotes, customers, projects…"
              aria-label="Search quotes"
              className="glass-input w-full"
            />
          </form>
          <Link href="/quotes/new" className="btn-glass-prominent">
            <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
            New Quote
          </Link>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="YTD Won Revenue"
          value={formatUSD(ytdTotal)}
          sub={`${wonCount} ${wonCount === 1 ? 'deal' : 'deals'} closed`}
          icon={<TrendingUp className="w-4 h-4" aria-hidden />}
          tone="emerald"
        />
        <KpiCard
          label="Avg Deal Size"
          value={wonCount > 0 ? formatUSD(avgDeal) : '—'}
          sub="This year"
          icon={<CheckCircle2 className="w-4 h-4" aria-hidden />}
          tone="amber"
        />
        <KpiCard
          label="Open Pipeline"
          value={String(openCount)}
          sub="Sent, engineering, or building"
          icon={<Clock className="w-4 h-4" aria-hidden />}
          tone="slate"
        />
      </div>

      {/* Chart + recent — chart takes the wider column on larger screens.
          Both cards share an explicit height so the list doesn't push the
          page past the fold; the list body scrolls internally when it
          exceeds the card. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-4">
        <div className="glass p-6 lg:h-[420px] flex flex-col">
          <RevenueChart data={monthData} year={year} />
        </div>

        <div className="glass overflow-hidden flex flex-col min-h-0 lg:h-[420px]">
          <div className="px-5 py-4 border-b border-slate-200/60 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Recent Quotes</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">Last 8 updates</p>
            </div>
            <Link
              href="/quotes"
              className="text-[13px] font-medium text-amber-700 hover:text-amber-900"
            >
              View all →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-slate-500">
              No quotes yet — start one from the button above.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200/60 overflow-y-auto flex-1 min-h-0">
              {recent.map((q) => {
                const href = `/quotes/${q.id}`;
                return (
                  <li key={q.id}>
                    <Link
                      href={href}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/60 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 font-mono text-[13px] text-slate-800">
                          <span>{q.number}</span>
                          <span className={STATUS_STYLE[q.status] ?? 'glass-chip'}>
                            {STATUS_LABEL[q.status] ?? q.status}
                          </span>
                        </div>
                        <div className="text-[13.5px] text-slate-700 mt-0.5 truncate">
                          {q.customer.name}
                          <span className="text-slate-400 mx-1.5">·</span>
                          {q.project ? (
                            formatFormula(q.project.name)
                          ) : (
                            <span className="text-slate-400 italic">No project</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {q.totalPrice != null && (
                          <div className="text-[13px] font-semibold text-slate-900 tabular-nums">
                            {formatUSD(q.totalPrice)}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(q.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone: 'emerald' | 'amber' | 'slate';
}) {
  const toneStyles: Record<string, string> = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
    amber: 'text-amber-700 bg-amber-50 border-amber-200/60',
    slate: 'text-slate-700 bg-slate-100 border-slate-200/60',
  };
  return (
    <div className="glass px-5 py-4 flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">
          {label}
        </div>
        <div className="text-[22px] font-semibold tracking-tight text-slate-900 mt-1 tabular-nums">
          {value}
        </div>
        <div className="text-[12px] text-slate-500 mt-0.5">{sub}</div>
      </div>
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center border ${toneStyles[tone]}`}
      >
        {icon}
      </span>
    </div>
  );
}
