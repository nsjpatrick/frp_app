import Link from 'next/link';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { PerPageSelect } from '@/components/PerPageSelect';
import { formatFormula } from '@/lib/format';

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PER_PAGE = 20;

const STATUS_STYLE: Record<string, string> = {
  DRAFT:        'glass-chip',
  SENT:         'glass-chip glass-tinted-slate',
  ENGINEERING:  'glass-chip glass-tinted-amber',
  BUILDING:     'glass-chip bg-sky-100/70 text-sky-900 border-sky-300/50',
  WON:          'glass-chip glass-tinted-emerald',
  LOST:         'glass-chip bg-rose-100/70 text-rose-900 border-rose-300/50',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ENGINEERING: 'Engineering',
  BUILDING: 'Building',
  WON: 'Won',
  LOST: 'Lost',
};

function clampPerPage(raw?: string): number {
  const n = Number(raw);
  return PER_PAGE_OPTIONS.includes(n as (typeof PER_PAGE_OPTIONS)[number])
    ? n
    : DEFAULT_PER_PAGE;
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; perPage?: string }>;
}) {
  const { page: pageRaw, perPage: perPageRaw } = await searchParams;
  const session = await auth();
  const user = session?.user as any;

  const perPage = clampPerPage(perPageRaw);
  const requestedPage = Math.max(1, Number(pageRaw) || 1);

  const where = { project: { customer: { tenantId: user.tenantId } } };
  const total = await db.quote.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(requestedPage, totalPages);

  const quotes = await db.quote.findMany({
    where,
    include: {
      project: { include: { customer: true } },
      revisions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * perPage,
    take: perPage,
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  const buildPageHref = (target: number) => {
    const next = new URLSearchParams();
    if (perPage !== DEFAULT_PER_PAGE) next.set('perPage', String(perPage));
    if (target !== 1) next.set('page', String(target));
    const qs = next.toString();
    return qs ? `/dashboard?${qs}` : '/dashboard';
  };

  return (
    // Height-capped so only the table scrolls, not the page.
    // Chrome: sticky nav (~72px) + main py-6 (48px) + this gap-5 (20px) + header row (~64px)
    // ≈ 200px. Dashboard card gets the remainder; internal table scrolls.
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 8rem)' }}>
      <header className="flex items-end justify-between gap-4 flex-wrap shrink-0">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Quotes</h1>
          <p className="text-[14px] text-slate-500 mt-0.5">
            Draft, sent, won, and lost quotes across all customers.
          </p>
        </div>
        <Link href="/quotes/new" className="btn-glass-prominent">
          <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          New Quote
        </Link>
      </header>

      {quotes.length === 0 && total === 0 ? (
        <div className="glass p-12 text-center">
          <div className="text-4xl mb-3" aria-hidden>📝</div>
          <div className="text-[16px] font-semibold text-slate-900">No Quotes Yet</div>
          <p className="text-[13.5px] text-slate-500 mt-1.5 max-w-md mx-auto">
            Start a new quote to walk through the configurator.
          </p>
          <Link href="/quotes/new" className="btn-glass-prominent mt-5 inline-flex">
            <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
            Start Your First Quote
          </Link>
        </div>
      ) : (
        // Flex-1 wrapper: fills the remaining height. Inside, an overflow-auto
        // region holds the table (so only the rows scroll). Pagination is a
        // footer that stays pinned to the bottom of the glass card.
        <div className="glass flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-[14px]">
              {/* Opaque — `backdrop-blur-md` inside the .glass table container
                  nests a second backdrop-filter, which Safari drops, leaving the
                  header invisible over scrolling rows. Solid white is safer. */}
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60">
                  <th className="px-5 py-3 font-semibold">Quote</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Project</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Rev</th>
                  <th className="px-5 py-3 font-semibold">Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-t border-slate-200/40 hover:bg-white/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-[13px] text-slate-800 whitespace-nowrap">
                      {q.number}
                    </td>
                    <td className="px-5 py-3 text-slate-900">{q.project.customer.name}</td>
                    <td className="px-5 py-3 text-slate-700">{formatFormula(q.project.name)}</td>
                    <td className="px-5 py-3">
                      <span className={STATUS_STYLE[q.status] ?? 'glass-chip'}>
                        {STATUS_LABEL[q.status] ?? q.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">Rev {q.revisions[0]?.label ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500 text-[13px] whitespace-nowrap">
                      {new Date(q.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {q.revisions[0] && (
                        <Link
                          href={`/quotes/${q.id}/rev/${q.revisions[0].label}/review`}
                          className="text-amber-700 hover:text-amber-900 text-[13px] font-medium whitespace-nowrap"
                        >
                          Open →
                        </Link>
                      )}
                    </td>
                    {/* "Open" kept as single-word action verb. */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer — pinned under the scroll region. */}
          <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-t border-slate-200/60 bg-white/50 flex-wrap">
            <div className="text-[13px] text-slate-500">
              Showing <strong className="text-slate-800">{rangeStart}–{rangeEnd}</strong> of{' '}
              <strong className="text-slate-800">{total}</strong>
            </div>

            <div className="flex items-center gap-4">
              <PerPageSelect value={perPage} />

              <div className="flex items-center gap-1">
                <Link
                  href={buildPageHref(page - 1)}
                  aria-disabled={page <= 1}
                  className={`p-2 rounded-full transition ${
                    page <= 1
                      ? 'text-slate-300 pointer-events-none'
                      : 'text-slate-600 hover:bg-white/70'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden />
                  <span className="sr-only">Previous page</span>
                </Link>
                <span className="text-[13px] text-slate-700 tabular-nums px-2">
                  Page {page} of {totalPages}
                </span>
                <Link
                  href={buildPageHref(page + 1)}
                  aria-disabled={page >= totalPages}
                  className={`p-2 rounded-full transition ${
                    page >= totalPages
                      ? 'text-slate-300 pointer-events-none'
                      : 'text-slate-600 hover:bg-white/70'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" aria-hidden />
                  <span className="sr-only">Next page</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
