import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { formatFormula } from '@/lib/format';

export default async function Step1({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const p = rev.quote.project;
  const c = p.customer;

  const facts: Array<[string, React.ReactNode]> = [
    ['Customer', c.name],
    ['Contact', c.contactName ?? '—'],
    ['Project', formatFormula(p.name)],
    ['Customer PO #', p.customerProjectNumber ?? '—'],
    ['Site Address', p.siteAddress ?? '—'],
    ['End Use', formatFormula(p.endUse) || '—'],
    ['Need By', p.needByDate ? new Date(p.needByDate).toLocaleDateString() : '—'],
    ['Quote #', rev.quote.number],
  ];

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-1">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 1 of 5
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Customer &amp; Project
        </h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Recap of the request you&apos;re quoting against. Edit details on the project page.
        </p>
      </header>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-start">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="glass-label">{label}</dt>
            <dd className="text-[15px] text-slate-900 font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex justify-end pt-8 mt-8 border-t border-slate-200/60">
        <Link
          href={`/quotes/${quoteId}/rev/${revLabel}/step-2`}
          className="btn-glass-prominent"
        >
          Next
          <ArrowRight className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    </WizardShell>
  );
}
