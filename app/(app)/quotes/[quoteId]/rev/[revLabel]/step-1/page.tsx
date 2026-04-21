import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';

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
    ['Project', p.name],
    ['Customer PO #', p.customerProjectNumber ?? '—'],
    ['Site address', p.siteAddress ?? '—'],
    ['End use', p.endUse ?? '—'],
    ['Need by', p.needByDate ? new Date(p.needByDate).toLocaleDateString() : '—'],
    ['Quote #', rev.quote.number],
  ];

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-1">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 1 of 5
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Customer &amp; project
        </h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Recap of the request you&apos;re quoting against. Edit details on the project page.
        </p>
      </header>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
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
          Next: Service &amp; certifications
          <span aria-hidden>→</span>
        </Link>
      </div>
    </WizardShell>
  );
}
