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

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-1">
      <h2 className="text-xl font-semibold mb-4">Customer & Project</h2>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-gray-500">Customer</dt><dd>{rev.quote.project.customer.name}</dd></div>
        <div><dt className="text-gray-500">Project</dt><dd>{rev.quote.project.name}</dd></div>
        <div><dt className="text-gray-500">Site address</dt><dd>{rev.quote.project.siteAddress ?? '—'}</dd></div>
        <div><dt className="text-gray-500">End use</dt><dd>{rev.quote.project.endUse ?? '—'}</dd></div>
      </dl>
      <div className="mt-6 text-right">
        <Link href={`/quotes/${quoteId}/rev/${revLabel}/step-2`} className="rounded bg-blue-600 text-white px-4 py-2 text-sm">
          Next: Service & Certifications →
        </Link>
      </div>
    </WizardShell>
  );
}
