import Link from 'next/link';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { PerPageSelect } from '@/components/PerPageSelect';
import { QuoteRowMenu } from '@/components/QuoteRowMenu';
import { QuoteStatusSelect } from '@/components/QuoteStatusSelect';
import { Prisma } from '@prisma/client';

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PER_PAGE = 20;

function clampPerPage(raw?: string): number {
  const n = Number(raw);
  return PER_PAGE_OPTIONS.includes(n as (typeof PER_PAGE_OPTIONS)[number])
    ? n
    : DEFAULT_PER_PAGE;
}

export default async function QuotesIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; perPage?: string; q?: string }>;
}) {
  const { page: pageRaw, perPage: perPageRaw, q: qRaw } = await searchParams;
  const session = await auth();
  const user = session?.user as any;

  const perPage = clampPerPage(perPageRaw);
  const requestedPage = Math.max(1, Number(pageRaw) || 1);
  const q = (qRaw ?? '').trim();

  // Tenant scope on Quote.customer directly so project-less quotes are
  // included. Search still ORs across quote number, customer name, and
  // (optional) project name.
  const where: Prisma.QuoteWhereInput = {
    customer: { tenantId: user.tenantId },
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
            { project: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const total = await db.quote.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(requestedPage, totalPages);

  const quotes = await db.quote.findMany({
    where,
    include: {
      customer: true,
      project: true,
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
    if (q) next.set('q', q);
    if (target !== 1) next.set('page', String(target));
    const qs = next.toString();
    return qs ? `/quotes?${qs}` : '/quotes';
  };

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 8rem)' }}>
      <header className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Quotes</h1>
        <div className="flex items-center gap-3 flex-1 justify-end">
          <form action="/quotes" method="get" className="relative flex-1 max-w-[560px]">
            <input
              type="search"
              name="q"
              defaultValue={q}
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

      {quotes.length === 0 && total === 0 ? (
        <div className="glass p-12 text-center">
          <div className="text-4xl mb-3" aria-hidden>{q ? '🔎' : '📝'}</div>
          <div className="text-[16px] font-semibold text-slate-900">
            {q ? 'No Matches' : 'No Quotes Yet'}
          </div>
          <p className="text-[13.5px] text-slate-500 mt-1.5 max-w-md mx-auto">
            {q
              ? `Nothing matched “${q}”. Try a broader term or clear the search.`
              : 'Start a new quote to walk through the configurator.'}
          </p>
          {q ? (
            <Link href="/quotes" className="btn-glass mt-5 inline-flex">
              Clear Search
            </Link>
          ) : (
            <Link href="/quotes/new" className="btn-glass-prominent mt-5 inline-flex">
              <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              Start Your First Quote
            </Link>
          )}
        </div>
      ) : (
        <div className="glass flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-[14px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60">
                  <th className="px-5 py-3 font-semibold">Quote</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Rev</th>
                  <th className="px-5 py-3 font-semibold">Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => {
                  const latestLabel = quote.revisions[0]?.label ?? 'A';
                  return (
                    <tr key={quote.id} className="border-t border-slate-200/40 hover:bg-white/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-[13px] text-slate-800 whitespace-nowrap">
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="hover:text-amber-700"
                        >
                          {quote.number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-900">{quote.customer.name}</td>
                      <td className="px-5 py-3">
                        <QuoteStatusSelect quoteId={quote.id} status={quote.status} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">Rev {latestLabel}</td>
                      <td className="px-5 py-3 text-slate-500 text-[13px] whitespace-nowrap">
                        {new Date(quote.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <QuoteRowMenu
                          quoteId={quote.id}
                          quoteNumber={quote.number}
                          currentLabel={latestLabel}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-t border-slate-200/60 bg-white/50 flex-wrap">
            <div className="text-[13px] text-slate-500">
              Showing <strong className="text-slate-800">{rangeStart}–{rangeEnd}</strong> of{' '}
              <strong className="text-slate-800">{total}</strong>
              {q && <span className="ml-1">for “{q}”</span>}
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
