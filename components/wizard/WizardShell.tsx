import Link from 'next/link';

const STEPS = [
  { n: 1, label: 'Customer & Project', path: 'step-1' },
  { n: 2, label: 'Service & Certifications', path: 'step-2' },
  { n: 3, label: 'Geometry', path: 'step-3' },
  { n: 4, label: 'Resin & Wall Buildup', path: 'step-4' },
  { n: 5, label: 'Review & Generate', path: 'review' },
];

export function WizardShell({
  quoteId,
  revLabel,
  current,
  children,
}: {
  quoteId: string;
  revLabel: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[220px_1fr_260px] gap-6">
      <nav className="space-y-1">
        {STEPS.map((s) => (
          <Link
            key={s.path}
            href={`/quotes/${quoteId}/rev/${revLabel}/${s.path}`}
            className={`block rounded px-3 py-2 text-sm ${
              current === s.path ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-xs text-gray-500 block">Step {s.n}</span>
            {s.label}
          </Link>
        ))}
      </nav>
      <div className="bg-white border rounded p-6">{children}</div>
      <aside className="bg-white border rounded p-4 text-sm">
        <div className="text-xs uppercase text-gray-500 mb-2">Live Summary</div>
        <div className="text-gray-500">Pricing engine arrives in Plan 3.</div>
      </aside>
    </div>
  );
}
