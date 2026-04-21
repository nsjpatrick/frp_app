import Link from 'next/link';

const STEPS = [
  { n: 1, label: 'Customer & Project', path: 'step-1' },
  { n: 2, label: 'Service & Certifications', path: 'step-2' },
  { n: 3, label: 'Geometry', path: 'step-3' },
  { n: 4, label: 'Resin & Wall Buildup', path: 'step-4' },
  { n: 5, label: 'Review & Generate', path: 'review' },
];

// Explicit visit order so we can decide what's "completed" vs "upcoming"
// relative to the current step. "Completed" is derived (everything before
// current) until we wire real completion signals from the revision state.
function stateFor(currentPath: string, stepPath: string): 'completed' | 'current' | 'upcoming' {
  const currentIdx = STEPS.findIndex((s) => s.path === currentPath);
  const thisIdx = STEPS.findIndex((s) => s.path === stepPath);
  if (thisIdx === currentIdx) return 'current';
  if (thisIdx < currentIdx) return 'completed';
  return 'upcoming';
}

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
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_300px] gap-5 mt-6">
      {/* Left — step nav. Shares pt-8 / pt-10 with the other two columns
          so the first content row (eyebrow / label) lines up horizontally. */}
      <aside className="glass px-3 pt-8 md:pt-10 pb-4 self-start sticky top-[92px]">
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

      {/* Center — content. p-8/p-10 top padding is the anchor the two rails
          match against. */}
      <section className="glass-raised p-8 md:p-10 min-h-[520px]">
        {children}
      </section>

      {/* Right — live summary rail. pt-8/pt-10 matches center column. */}
      <aside className="glass px-5 pt-8 md:pt-10 pb-5 self-start sticky top-[92px]">
        <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-500 mb-3">
          Live Summary
        </div>
        {summary ?? (
          <div className="space-y-3 text-sm">
            <div className="glass-chip">Pricing engine lands in Plan 3</div>
            <p className="text-slate-500 text-[13px] leading-relaxed">
              Totals, material breakdowns, and engineering-review flags will
              appear here as you move through the wizard.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
