'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutGrid, Table as TableIcon, Plus } from 'lucide-react';
import { createQuote } from '@/lib/actions/quotes';
import { formatFormula } from '@/lib/format';
import { SEED_RESINS } from '@/lib/catalog/seed-data';
import { EditProjectModal } from '@/components/EditProjectModal';

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

type QuoteRow = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  revision: {
    label: string;
    service: any;
    geometry: any;
    wallBuildup: any;
  } | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  siteAddress: string | null;
  endUse: string | null;
  needByDate: string | null;
  createdAt: string;
  customer: { id: string; name: string };
  quotes: QuoteRow[];
};

/**
 * Project detail — header + per-project quote listing. Toggles between a
 * dense table view (good for scanning large pipelines) and a card grid
 * (at-a-glance scope + status per quote). View state is client-local; no
 * URL persistence yet — add if product asks.
 */
export function ProjectDetailClient({ project }: { project: Project }) {
  const [view, setView] = useState<'table' | 'cards'>('table');

  const counts = project.quotes.reduce(
    (acc, q) => ((acc[q.status] = (acc[q.status] ?? 0) + 1), acc),
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <Link
          href={`/customers/${project.customer.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
          {project.customer.name}
        </Link>

        <div className="flex items-end justify-between gap-4 flex-wrap mt-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-semibold tracking-tight text-slate-900 truncate">
              {formatFormula(project.name)}
            </h1>
            {/* Meta line first (site · end use · need-by); description moved
                below so it sits above the status chip row. */}
            <div className="flex items-center gap-3 flex-wrap text-[13.5px] text-slate-500 mt-1.5">
              {project.siteAddress && <span>{project.siteAddress}</span>}
              {project.endUse && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{formatFormula(project.endUse)}</span>
                </>
              )}
              {project.needByDate && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>Need by {new Date(project.needByDate).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <EditProjectModal
              project={{
                id: project.id,
                name: project.name,
                description: project.description,
                siteAddress: project.siteAddress,
                needByDate: project.needByDate,
              }}
            />
            <form action={createQuote}>
              <input type="hidden" name="projectId" value={project.id} />
              <button type="submit" className="btn-glass-prominent">
                <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                New Quote
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Description — rendered below the title + meta line, above chips. */}
      {project.description && (
        <p className="text-[14px] text-slate-600 max-w-3xl leading-relaxed whitespace-pre-wrap">
          {formatFormula(project.description)}
        </p>
      )}

      {/* Status roll-up chips + view toggle — single horizontal row. */}
      {project.quotes.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap gap-2">
            {(['DRAFT', 'SENT', 'ENGINEERING', 'BUILDING', 'WON', 'SHIPPED', 'LOST'] as const).map((s) =>
              counts[s] ? (
                <span key={s} className={`${STATUS_STYLE[s]} text-[11.5px]`}>
                  {counts[s]} {STATUS_LABEL[s]}
                </span>
              ) : null,
            )}
            <span className="glass-chip text-[11.5px]">
              {project.quotes.length} Total
            </span>
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
      )}

      {project.quotes.length === 0 ? (
        <EmptyState projectId={project.id} />
      ) : view === 'table' ? (
        <QuotesTable quotes={project.quotes} />
      ) : (
        <QuotesCardGrid quotes={project.quotes} />
      )}
    </div>
  );
}

/* ─────────────────────────── View toggle ─────────────────────────── */

function ViewToggle({
  value,
  onChange,
}: {
  value: 'table' | 'cards';
  onChange: (v: 'table' | 'cards') => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Quote list view"
      className="inline-flex items-center gap-1 bg-white rounded-full border border-slate-200 p-1"
    >
      <button
        role="tab"
        aria-selected={value === 'table'}
        onClick={() => onChange('table')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
          value === 'table'
            ? 'bg-amber-600 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <TableIcon className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />
        Table
      </button>
      <button
        role="tab"
        aria-selected={value === 'cards'}
        onClick={() => onChange('cards')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
          value === 'cards'
            ? 'bg-amber-600 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />
        Cards
      </button>
    </div>
  );
}

/* ─────────────────────────── Empty state ─────────────────────────── */

function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="bg-white/85 border border-slate-200/60 rounded-2xl p-10 text-center"
         style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)' }}>
      <div className="text-4xl mb-3" aria-hidden>📝</div>
      <div className="text-[16px] font-semibold text-slate-900">No Quotes Yet</div>
      <p className="text-[13.5px] text-slate-500 mt-1.5 mb-5 max-w-md mx-auto">
        Create the first quote to enter the configurator for this project.
      </p>
      <form action={createQuote} className="inline-block">
        <input type="hidden" name="projectId" value={projectId} />
        <button type="submit" className="btn-glass-prominent">
          <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          Start First Quote
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────── Table view ─────────────────────────── */

function QuotesTable({ quotes }: { quotes: QuoteRow[] }) {
  return (
    <div className="glass overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full text-[14px]">
          <thead className="bg-white">
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60">
              <th className="px-5 py-3 font-semibold">Quote</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Rev</th>
              <th className="px-5 py-3 font-semibold">Service</th>
              <th className="px-5 py-3 font-semibold">Resin</th>
              <th className="px-5 py-3 font-semibold">Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => {
              const chemical = q.revision?.service?.chemical as string | undefined;
              const resinId = q.revision?.wallBuildup?.resinId as string | undefined;
              const resinName = resinId
                ? SEED_RESINS.find((r) => r.id === resinId)?.name ?? resinId
                : null;
              return (
                <tr
                  key={q.id}
                  className="border-t border-slate-200/40 hover:bg-white/50 transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-[13px] whitespace-nowrap">
                    {q.revision ? (
                      <Link
                        href={`/quotes/${q.id}/rev/${q.revision.label}/review`}
                        className="text-slate-800 hover:text-amber-700 transition-colors"
                      >
                        {q.number}
                      </Link>
                    ) : (
                      <span className="text-slate-800">{q.number}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={STATUS_STYLE[q.status] ?? 'glass-chip'}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">Rev {q.revision?.label ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-700">
                    {chemical ? formatFormula(chemical) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-700 text-[13px]">
                    {resinName ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-[13px] whitespace-nowrap">
                    {new Date(q.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {q.revision ? (
                      <Link
                        href={`/quotes/${q.id}/rev/${q.revision.label}/review`}
                        className="text-amber-700 hover:text-amber-900 text-[13px] font-medium whitespace-nowrap"
                      >
                        Open →
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-[13px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────── Card view ─────────────────────────── */

function QuotesCardGrid({ quotes }: { quotes: QuoteRow[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
      {quotes.map((q) => (
        <QuoteCard key={q.id} quote={q} />
      ))}
    </div>
  );
}

function QuoteCard({ quote }: { quote: QuoteRow }) {
  const s = quote.revision?.service as any;
  const g = quote.revision?.geometry as any;
  const w = quote.revision?.wallBuildup as any;

  const chemical = s?.chemical as string | undefined;
  const designTempF = s?.designTempF as number | undefined;
  const sg = s?.specificGravity as number | undefined;
  const idIn = g?.idIn as number | undefined;
  const ssHeightIn = g?.ssHeightIn as number | undefined;
  const orientation = g?.orientation as string | undefined;

  const diameterFt = idIn != null ? (idIn / 12).toFixed(1) : null;
  const heightFt = ssHeightIn != null ? (ssHeightIn / 12).toFixed(1) : null;

  const resinId = w?.resinId as string | undefined;
  const resin = resinId ? SEED_RESINS.find((r) => r.id === resinId) : null;

  return (
    <div
      className="bg-white/90 border border-slate-200/70 rounded-2xl p-5 flex flex-col transition-transform hover:-translate-y-0.5"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.04), 0 10px 30px -16px rgba(15,23,42,0.15)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {quote.revision ? (
            <Link
              href={`/quotes/${quote.id}/rev/${quote.revision.label}/review`}
              className="font-mono tabular-nums text-[15px] text-slate-900 font-semibold hover:text-amber-700 transition-colors"
            >
              {quote.number}
            </Link>
          ) : (
            <span className="font-mono tabular-nums text-[15px] text-slate-900 font-semibold">
              {quote.number}
            </span>
          )}
          <div className="text-[12px] text-slate-500 mt-0.5">
            Rev {quote.revision?.label ?? '—'} · Updated{' '}
            {new Date(quote.updatedAt).toLocaleDateString()}
          </div>
        </div>
        <span className={`${STATUS_STYLE[quote.status] ?? 'glass-chip'} text-[11px] shrink-0 whitespace-nowrap`}>
          {STATUS_LABEL[quote.status] ?? quote.status}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-[13px]">
        <Line label="Service">
          {chemical ? (
            <>
              {formatFormula(chemical)}
              {designTempF != null && <span className="text-slate-400"> · {designTempF}°F</span>}
              {sg != null && <span className="text-slate-400"> · SG {sg}</span>}
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </Line>

        <Line label="Vessel">
          {orientation && diameterFt && heightFt ? (
            <span className="capitalize">
              {diameterFt}&apos; ID × {heightFt}&apos; SS {orientation}
            </span>
          ) : (
            <span className="text-slate-400">Geometry pending</span>
          )}
        </Line>

        <Line label="Resin">
          {resin ? (
            <>
              {resin.name}
              <span className="text-slate-400"> · {resin.supplier}</span>
            </>
          ) : (
            <span className="text-slate-400">Not selected</span>
          )}
        </Line>
      </div>

      {/* Mock pricing placeholder — replaced by real totals in Plan 3. */}
      <div className="mt-4 pt-4 border-t border-slate-200/80 flex items-baseline justify-between">
        <span className="text-[10.5px] font-semibold tracking-widest uppercase text-slate-400">
          Quote Total (Preview)
        </span>
        <span className="font-mono tabular-nums text-[15px] font-semibold text-slate-900">
          $50,112
        </span>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-200/80">
        {quote.revision ? (
          <Link
            href={`/quotes/${quote.id}/rev/${quote.revision.label}/review`}
            className="text-[13px] font-medium text-amber-700 hover:text-amber-900"
          >
            Open Quote →
          </Link>
        ) : (
          <span className="text-[12.5px] text-slate-400">No revisions yet</span>
        )}
      </div>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10.5px] font-semibold tracking-widest uppercase text-slate-500 w-14 shrink-0">
        {label}
      </span>
      <span className="text-slate-800 truncate">{children}</span>
    </div>
  );
}
