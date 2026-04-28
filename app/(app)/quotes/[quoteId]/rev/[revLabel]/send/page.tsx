import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { RecipientForm } from '@/components/wizard/RecipientForm';
import { computeStepCompleteness, resolveGuardedStep } from '@/lib/revisions/completeness';

export default async function SendStep({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { customer: true, project: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== user.tenantId) notFound();

  const completeness = computeStepCompleteness({
    revision: rev,
    quote: { totalPrice: rev.quote.totalPrice ?? null },
  });
  const allowed = resolveGuardedStep('send', completeness);
  if (allowed !== 'send') redirect(`/quotes/${quoteId}/rev/${revLabel}/${allowed}`);

  const customer = rev.quote.customer;
  const project  = rev.quote.project;

  // All projects under this customer feed the "Attach to existing project"
  // picker. Sorted most-recently-created first so the thing the rep just
  // made shows at the top.
  const availableProjects = await db.project.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, siteAddress: true },
  });

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="send">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 4 of 4
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Customer &amp; Project
        </h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Confirm the recipient and project details. Hitting <strong>Complete and Save</strong>
          downloads the customer-facing PDF and returns you to the quotes queue.
        </p>
      </header>

      <RecipientForm
        customerId={customer.id}
        customerName={customer.name}
        projectId={project?.id ?? null}
        availableProjects={availableProjects}
        quoteNumber={rev.quote.number}
        quoteId={quoteId}
        revLabel={revLabel}
        initial={{
          contactName:  customer.contactName ?? '',
          contactEmail: customer.contactEmail ?? '',
          contactPhone: customer.contactPhone ?? '',
          projectName:  project?.name ?? '',
          siteAddress:  project?.siteAddress ?? '',
          description:  project?.description ?? '',
          addressLine1: customer.addressLine1 ?? '',
          addressLine2: customer.addressLine2 ?? '',
          city:         customer.city         ?? '',
          region:       customer.region       ?? '',
          postalCode:   customer.postalCode   ?? '',
          country:      customer.country      ?? '',
          salesEngineerId: typeof (rev.outputs as any)?.salesEngineerId === 'string'
            ? (rev.outputs as any).salesEngineerId
            : '',
        }}
      />
    </WizardShell>
  );
}
