import Link from 'next/link';
import { db } from '@/lib/db';
import { LiveSummary } from './LiveSummary';
import {
  computeStepCompleteness,
  type StepPath,
} from '@/lib/revisions/completeness';

const STEPS: Array<{ n: number; label: string; path: StepPath }> = [
  { n: 1, label: 'Service & Certifications', path: 'step-1' },
  { n: 2, label: 'Geometry',                 path: 'step-2' },
  { n: 3, label: 'Review & Generate',        path: 'review' },
  { n: 4, label: 'Customer & Project',       path: 'send' },
];

/**
 * Given the current step path + per-step completeness, decide how each
 * nav pill should render:
 *   - `current`   → this step
 *   - `completed` → earlier step; always clickable (lets reps fix things)
 *   - `allowed`   → upcoming step whose prerequisites are all complete; clickable
 *   - `locked`    → upcoming step whose prerequisites aren't done; greyed out,
 *                   pointer-events disabled so the rep can't jump ahead
 */
function stateFor(
  currentPath: StepPath,
  stepPath: StepPath,
  completeness: Record<StepPath, boolean>,
): 'completed' | 'current' | 'allowed' | 'locked' {
  const currentIdx = STEPS.findIndex((s) => s.path === currentPath);
  const thisIdx = STEPS.findIndex((s) => s.path === stepPath);
  if (thisIdx === currentIdx) return 'current';
  if (thisIdx < currentIdx) return 'completed';
  // Upcoming step — allow iff every step before it is complete.
  for (let i = 0; i < thisIdx; i++) {
    if (!completeness[STEPS[i].path]) return 'locked';
  }
  return 'allowed';
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
export async function WizardShell({
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
  // Load the revision + quote once so the rail's LiveSummary can seed
  // the pricing engine, and so the nav can gate upcoming steps by
  // per-step completeness. A pass-through `summary` still wins if a
  // caller wants to override the rail entirely.
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: true },
  });
  const pricingInputs = rev && !summary
    ? {
        geometry: (rev.geometry ?? {}) as any,
        service: (rev.service ?? {}) as any,
        certs: (rev.certs ?? {}) as any,
        wallBuildup: (rev.wallBuildup ?? {}) as any,
      }
    : null;

  const completeness = rev
    ? computeStepCompleteness({
        revision: rev,
        quote: { totalPrice: rev.quote.totalPrice ?? null },
      })
    : { 'step-1': false, 'step-2': false, review: false, send: false };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_300px] gap-5 mt-6 items-start">
      {/* Left — step nav. Natural height; hugs its content. */}
      <aside className="glass px-3 pt-6 md:pt-8 pb-4">
        <div className="px-2 pb-3 text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-500">
          Quote {quoteId.slice(0, 6)} · Rev {revLabel}
        </div>
        <nav className="space-y-1">
          {STEPS.map((s) => {
            const state = stateFor(current as StepPath, s.path, completeness);
            const isLocked = state === 'locked';
            const stateClass =
              state === 'current' ? 'current'
              : state === 'completed' ? 'completed'
              : state === 'allowed' ? 'upcoming'
              : 'locked';
            const href = `/quotes/${quoteId}/rev/${revLabel}/${s.path}`;
            const pillClass = `step-pill ${stateClass} ${isLocked ? 'pointer-events-none opacity-50 cursor-not-allowed' : ''}`;
            // Locked upcoming steps render as a non-link <span> so they're
            // also keyboard-inert and won't even be considered for nav even
            // if someone forces a click through dev tools. Server action on
            // the step page then redirects to the earliest incomplete step,
            // so URL manipulation can't bypass the gate either.
            if (isLocked) {
              return (
                <span
                  key={s.path}
                  role="link"
                  aria-disabled
                  tabIndex={-1}
                  title="Finish the previous step first"
                  className={pillClass}
                >
                  <span className="step-num">{s.n}</span>
                  <span className="flex-1">{s.label}</span>
                </span>
              );
            }
            return (
              <Link key={s.path} href={href} className={pillClass}>
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
        {summary ?? (pricingInputs
          ? <LiveSummary inputs={pricingInputs} />
          : <LiveSummary inputs={{ geometry: {}, service: {}, certs: {}, wallBuildup: {} }} />
        )}
      </aside>
    </div>
  );
}
