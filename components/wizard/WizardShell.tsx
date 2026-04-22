import Link from 'next/link';
import { LiveSummaryMock } from './LiveSummaryMock';

const STEPS = [
  { n: 1, label: 'Service & Certifications', path: 'step-1' },
  { n: 2, label: 'Geometry',                 path: 'step-2' },
  { n: 3, label: 'Resin & Wall Buildup',     path: 'step-3' },
  { n: 4, label: 'Review & Generate',        path: 'review' },
  { n: 5, label: 'Customer & Project',       path: 'send' },
];

function stateFor(currentPath: string, stepPath: string): 'completed' | 'current' | 'upcoming' {
  const currentIdx = STEPS.findIndex((s) => s.path === currentPath);
  const thisIdx = STEPS.findIndex((s) => s.path === stepPath);
  if (thisIdx === currentIdx) return 'current';
  if (thisIdx < currentIdx) return 'completed';
  return 'upcoming';
}

/**
 * WizardShell — 3-column configurator layout.
 *
 * Vertical sizing: rails (left + right) use `self-start` so each column hugs
 * its own content; the CENTER column has `max-height: calc(100vh - 9rem)` +
 * `overflow-y-auto`, so when page content is short everything stays compact,
 * and when the form is long only the middle scrolls while the rails stay
 * visible above the fold.
 *
 * Top alignment: all three columns use the same `pt-6 md:pt-8` so their
 * first visible row (left = "Quote · Rev" eyebrow, middle = step page
 * header, right = live-summary eyebrow) sits at the same Y.
 */
export function WizardShell({
  quoteId,
  revLabel,
  current,
  children,
  summary,
}: {
  quoteId: string;
  revLabel: string;
  current: string;
  children: React.ReactNode;
  summary?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_300px] gap-5 mt-6 items-start">
      {/* Left — step nav. Natural height; hugs its content. */}
      <aside className="glass px-3 pt-6 md:pt-8 pb-4">
        <div className="px-2 pb-3 text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-500">
          Quote {quoteId.slice(0, 6)} · Rev {revLabel}
        </div>
        <nav className="space-y-1">
          {STEPS.map((s) => {
            const state = stateFor(current, s.path);
            return (
              <Link
                key={s.path}
                href={`/quotes/${quoteId}/rev/${revLabel}/${s.path}`}
                className={`step-pill ${state}`}
              >
                <span className="step-num">
                  {state === 'completed' ? '✓' : s.n}
                </span>
                <span className="flex-1">{s.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Center — the only column that can scroll internally. Max-height
          keeps it within the viewport so page-level scroll never engages
          while the rails stay in place. */}
      <section
        className="glass-raised px-8 md:px-10 pt-6 md:pt-8 pb-6 md:pb-8 overflow-y-auto min-h-0"
        style={{ maxHeight: 'calc(100vh - 9rem)' }}
      >
        {children}
      </section>

      {/* Right — live summary. Natural height; hugs its content. */}
      <aside className="glass px-5 pt-6 md:pt-8 pb-5">
        {summary ?? <LiveSummaryMock />}
      </aside>
    </div>
  );
}
