import Link from 'next/link';
import { db } from '@/lib/db';
import { LiveSummary } from './LiveSummary';
import { ClearAllFieldsButton } from './ClearAllFieldsButton';
import {
  computeStepCompleteness,
  type StepPath,
} from '@/lib/revisions/completeness';
import { getDefaultsForTankType } from '@/lib/catalog/tank-type-defaults';

const STEPS: Array<{ n: number; label: string; path: StepPath }> = [
  { n: 1, label: 'Specs & Service',  path: 'step-1' },
  { n: 2, label: 'Fittings',         path: 'step-2' },
  { n: 3, label: 'Review',           path: 'review' },
  { n: 4, label: 'Send',             path: 'send' },
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
 * WizardShell — horizontal stepper on top, configurator + LiveSummary below.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [Quote · Rev]   [1] ── [2] ── [3] ── [4]                 │  top stepper
 *   ├──────────────────────────────────────────┬───────────────┤
 *   │  Configurator (spans available width)    │  LiveSummary  │
 *   └──────────────────────────────────────────┴───────────────┘
 *
 * The configurator no longer competes with a 260px left rail, so it gets
 * ~260px more horizontal real estate — the existing responsive grids
 * inside each form section reflow naturally to use the room. The
 * LiveSummary rail keeps its 300px column on the right.
 *
 * Top alignment: stepper sits above both columns, so the configurator
 * and LiveSummary both start at the same Y just below the bar.
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
  // Pricing inputs for the rail's first paint. When a field hasn't been
  // persisted yet (e.g. Step 2 hasn't been saved on a fresh Bryneer quote)
  // we fall back to the tank-type's default accessories so the rail shows
  // the Bryneer-package price the AccessoriesSection is about to display
  // — otherwise the rail flashes a bare-tank number until the rep
  // touches any field and triggers `LivePricingSync`.
  const pricingInputs = rev && !summary
    ? (() => {
        const service: any = rev.service ?? {};
        const geom: any = rev.geometry ?? {};
        const tankDefaults = getDefaultsForTankType(service.tankType);
        return {
          geometry: {
            ...geom,
            accessories: geom.accessories ?? tankDefaults.accessories,
            // Same backfill for nozzles — Step 2 may not have been saved.
            nozzles: Array.isArray(geom.nozzles) && geom.nozzles.length > 0
              ? geom.nozzles
              : tankDefaults.geometry.nozzles,
          } as any,
          service: rev.service as any,
          certs: rev.certs as any,
          wallBuildup: rev.wallBuildup as any,
        };
      })()
    : null;

  const completeness = rev
    ? computeStepCompleteness({
        revision: rev,
        quote: { totalPrice: rev.quote.totalPrice ?? null },
      })
    : { 'step-1': false, 'step-2': false, review: false, send: false };

  return (
    // The step bar gets equal breathing room above (24px from the
    // `<main>` element's pt-6) and below (24px gap before the
    // configurator). No top-margin on the wizard wrapper itself so the
    // two distances stay symmetric.
    //
    // `h-[calc(100dvh-8rem)]` pins the whole wizard to the viewport so
    // the page itself never scrolls — the step bar stays fixed at the
    // top, and the configurator + LiveSummary handle their own internal
    // scroll when content exceeds the available column height. 8rem
    // accounts for the sticky nav (~64px) + main's py-6 padding (48px)
    // + a small buffer. `dvh` (dynamic viewport height) tracks mobile
    // browser chrome correctly; `vh` is the fallback.
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)] [@supports(height:100dvh)]:h-[calc(100dvh-8rem)] min-h-0">
      {/* Top — horizontal step tracker.
          The pills sit absolutely centered against the bar; the eyebrow
          and Clear-all action are absolutely positioned at the left and
          right edges so neither one's width pushes the pills off-center.
          On narrow screens the bar collapses to a stack. */}
      <nav
        aria-label="Wizard steps"
        className="glass px-4 md:px-5 py-3 flex flex-col gap-3 md:relative md:flex-row md:items-center md:justify-center md:min-h-[3.25rem]"
      >
        <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-500 whitespace-nowrap md:absolute md:left-5 md:top-1/2 md:-translate-y-1/2 shrink-0">
          Quote {quoteId.slice(0, 6)} · Rev {revLabel}
        </div>
        {/* Pills + connector lines. The lines are pseudo-elements on each
            pill (except the first) so they shorten / hide automatically on
            narrow screens where the row wraps. */}
        <ol className="flex flex-wrap items-center justify-center gap-y-2">
          {STEPS.map((s, idx) => {
            const state = stateFor(current as StepPath, s.path, completeness);
            const isLocked = state === 'locked';
            const stateClass =
              state === 'current' ? 'current'
              : state === 'completed' ? 'completed'
              : state === 'allowed' ? 'upcoming'
              : 'locked';
            const href = `/quotes/${quoteId}/rev/${revLabel}/${s.path}`;
            const pillClass = `step-pill ${stateClass} ${isLocked ? 'pointer-events-none opacity-50 cursor-not-allowed' : ''}`;
            const inner = (
              <>
                <span className="step-num">
                  {state === 'completed' ? '✓' : s.n}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
              </>
            );
            return (
              <li key={s.path} className="flex items-center min-w-0">
                {idx > 0 && (
                  <span
                    aria-hidden
                    className="hidden md:block w-6 lg:w-10 h-px bg-slate-300/80 mx-1"
                  />
                )}
                {isLocked ? (
                  <span
                    role="link"
                    aria-disabled
                    tabIndex={-1}
                    title="Finish the previous step first"
                    className={pillClass}
                  >
                    {inner}
                  </span>
                ) : (
                  <Link href={href} className={pillClass}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>

        {/* Right-edge Reset-all action — absolute-positioned at md+ so
            the pills above stay truly centered against the bar. Restores
            FRP Vessel defaults across every step (server-side wipe of
            the revision), then navigates the rep back to Step 1. */}
        <div className="shrink-0 md:absolute md:right-5 md:top-1/2 md:-translate-y-1/2">
          <ClearAllFieldsButton quoteId={quoteId} revLabel={revLabel} />
        </div>
      </nav>

      {/* Below — configurator + live summary, sharing the remaining
          vertical space. Each column scrolls internally; `min-h-0` on
          the row + each column lets flex/grid actually shrink them so
          their `overflow-y-auto` can engage instead of pushing the
          page taller. The pricing rail uses `items-start` + `max-h-full`
          so it hugs its content vertically — and only starts scrolling
          if the breakdown ever exceeds the available height. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 flex-1 min-h-0 items-start lg:h-full">
        <section className="glass-raised px-6 md:px-10 pt-6 md:pt-8 pb-6 md:pb-8 overflow-y-auto min-h-0 h-full w-full">
          {children}
        </section>

        <aside className="glass px-5 pt-6 md:pt-8 pb-5 overflow-y-auto min-h-0 max-h-full w-full">
          {summary ?? (pricingInputs
            ? <LiveSummary inputs={pricingInputs} />
            : <LiveSummary inputs={{ geometry: {}, service: {}, certs: {}, wallBuildup: {} }} />
          )}
        </aside>
      </div>
    </div>
  );
}
