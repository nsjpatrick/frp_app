import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, FileText, Pencil, Eye, Building2, User as UserIcon } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { QuoteStatusSelect } from '@/components/QuoteStatusSelect';
import { QuoteRowMenu } from '@/components/QuoteRowMenu';
import { formatUSD } from '@/lib/format';
import { TANK_TYPE_BY_ID } from '@/lib/catalog/tank-types';
import { computePricing } from '@/lib/pricing/pricing-engine';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}): Promise<Metadata> {
  const { quoteId } = await params;
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { number: true },
  });
  return {
    title: quote ? `${quote.number} | JobCalc Neo` : 'Quote | JobCalc Neo',
  };
}

/**
 * Quote detail page.
 *
 * Central landing for a quote — summary header, revision history with per-
 * rev PDF re-download (no rev bump), primary "Edit" action that clones into
 * the next revision. Linked from the quotes list and anywhere else a quote
 * ID appears. Previously clicking the quote number hopped straight into
 * `/rev/A/review`, which meant there was no stable URL for the quote
 * itself — exactly what the rep needs when reopening an existing record.
 */
export default async function QuoteDetail({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const session = await auth();
  const user = session?.user as any;

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      customer: true,
      project: true,
      revisions: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!quote || quote.customer.tenantId !== user.tenantId) notFound();

  const latest = quote.revisions[0];
  const latestService: any = latest?.service ?? {};
  const latestGeom: any = latest?.geometry ?? {};
  const tankType = latestService.tankType
    ? TANK_TYPE_BY_ID[latestService.tankType]
    : null;
  const quantity = Number(latestGeom.quantity) > 1 ? Number(latestGeom.quantity) : 1;

  // Live-engine price of the latest revision — shown on the detail page
  // so the rep sees a current number even if the quote hasn't been sent
  // yet (`totalPrice` only commits at Send time).
  const livePricing = latest
    ? computePricing({
        geometry: (latest.geometry ?? {}) as any,
        service: (latest.service ?? {}) as any,
        certs: (latest.certs ?? {}) as any,
        wallBuildup: (latest.wallBuildup ?? {}) as any,
      })
    : null;
  const displayTotal =
    quote.totalPrice != null
      ? formatUSD(quote.totalPrice)
      : livePricing
        ? formatUSD(livePricing.totalDelivered)
        : '—';

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/quotes"
            className="text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5 text-[13px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            All quotes
          </Link>
        </div>
        {latest && (
          <QuoteRowMenu
            quoteId={quote.id}
            quoteNumber={quote.number}
            currentLabel={latest.label}
          />
        )}
      </div>

      <header className="flex items-end justify-between gap-5 flex-wrap">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-700 mb-1.5">
            Quotation
          </div>
          <h1 className="text-[30px] font-semibold tracking-tight text-slate-900 leading-none">
            {quote.number}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-[14px] text-slate-600 flex-wrap">
            <Link
              href={`/customers/${quote.customer.id}`}
              className="inline-flex items-center gap-1.5 hover:text-slate-900"
            >
              <Building2 className="w-4 h-4 text-slate-400" aria-hidden />
              {quote.customer.name}
            </Link>
            {quote.project && (
              <>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" aria-hidden />
                  {quote.project.name}
                </span>
              </>
            )}
            {tankType && (
              <>
                <span className="text-slate-300">·</span>
                <span>{tankType.label}</span>
              </>
            )}
            {quantity > 1 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-medium">Qty {quantity}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <QuoteStatusSelect quoteId={quote.id} status={quote.status} />
          {latest && (
            <Link
              href={`/quotes/${quote.id}/rev/${latest.label}/quote.pdf`}
              className="btn-glass-prominent"
              aria-label={`Download PDF for Rev ${latest.label}`}
            >
              <Download className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              Download PDF
            </Link>
          )}
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={quote.totalPrice != null ? 'Total delivered' : 'Live estimate'}
          value={displayTotal}
        />
        <StatCard label="Status" value={quote.status} />
        <StatCard
          label="Created"
          value={new Date(quote.createdAt).toLocaleDateString()}
        />
        <StatCard
          label="Last updated"
          value={new Date(quote.updatedAt).toLocaleDateString()}
        />
      </div>

      {/* Revisions */}
      <section className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Revisions</h2>
          <span className="text-[12px] text-slate-500">
            {quote.revisions.length} total
          </span>
        </div>

        {quote.revisions.length === 0 ? (
          <div className="text-[13px] text-slate-500 py-6 text-center">
            No revisions yet. Start the configurator to create Rev A.
          </div>
        ) : (
          <div className="divide-y divide-slate-200/70">
            {quote.revisions.map((rev, idx) => {
              const svc: any = rev.service ?? {};
              const geom: any = rev.geometry ?? {};
              const isLatest = idx === 0;
              return (
                <div key={rev.id} className="flex items-center gap-4 py-3">
                  <div className="flex items-center gap-2 min-w-[92px]">
                    <span className="font-mono text-[13px] font-semibold text-slate-900">Rev {rev.label}</span>
                    {isLatest && (
                      <span className="glass-chip glass-tinted-amber text-[10.5px] px-1.5 py-0">Latest</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-[13px] text-slate-600">
                    <div className="truncate">
                      {svc.chemical || <span className="text-slate-400">No chemistry</span>}
                      {svc.designTempF != null && <span className="text-slate-500"> · {svc.designTempF}°F</span>}
                      {geom.idIn && geom.ssHeightIn && (
                        <span className="text-slate-500"> · {geom.idIn}″ × {geom.ssHeightIn}″</span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-slate-400 mt-0.5">
                      Saved {new Date(rev.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href={`/quotes/${quote.id}/rev/${rev.label}/review`}
                      className="btn-glass !px-2.5 !py-1.5 !text-[12.5px]"
                      aria-label={`Review Rev ${rev.label}`}
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden />
                      Review
                    </Link>
                    <Link
                      href={`/quotes/${quote.id}/rev/${rev.label}/quote.pdf`}
                      className="btn-glass !px-2.5 !py-1.5 !text-[12.5px]"
                      aria-label={`Download PDF for Rev ${rev.label}`}
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden />
                      PDF
                    </Link>
                    {isLatest && (
                      <Link
                        href={`/quotes/${quote.id}/rev/${rev.label}/step-1`}
                        className="btn-glass !px-2.5 !py-1.5 !text-[12.5px]"
                        aria-label={`Edit Rev ${rev.label}`}
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden />
                        Edit
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recipient snapshot */}
      <section className="glass p-5">
        <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight mb-4">Recipient</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13.5px]">
          <div>
            <div className="glass-label mb-1.5">Customer</div>
            <div className="font-medium text-slate-900">{quote.customer.name}</div>
            {quote.customer.contactName && (
              <div className="text-slate-600 mt-1 inline-flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" aria-hidden />
                {quote.customer.contactName}
              </div>
            )}
            {quote.customer.contactEmail && (
              <div className="text-slate-600 mt-0.5">{quote.customer.contactEmail}</div>
            )}
            {quote.customer.contactPhone && (
              <div className="text-slate-600 mt-0.5">{quote.customer.contactPhone}</div>
            )}
          </div>
          <div>
            <div className="glass-label mb-1.5">Project</div>
            {quote.project ? (
              <>
                <div className="font-medium text-slate-900">{quote.project.name}</div>
                {quote.project.siteAddress && (
                  <div className="text-slate-600 mt-1">{quote.project.siteAddress}</div>
                )}
              </>
            ) : (
              <div className="text-slate-400">Not linked to a project</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="bg-white/85 border border-slate-200/60 rounded-2xl px-4 py-3.5"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)' }}
    >
      <div className="glass-label mb-1">{label}</div>
      <div className="text-[18px] font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
