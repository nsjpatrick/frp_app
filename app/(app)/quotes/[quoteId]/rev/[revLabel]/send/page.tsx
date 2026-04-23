import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { RecipientForm } from '@/components/wizard/RecipientForm';
import { buildCustomerEmailBody } from '@/lib/outputs/customer-email';
import { SEED_RESINS } from '@/lib/catalog/seed-data';

export default async function SendStep({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { customer: true, project: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== user.tenantId) notFound();

  const customer = rev.quote.customer;
  const project  = rev.quote.project;

  // Pre-compute the mailto body once on the server so the client can fire
  // the mailto link instantly after the save-action resolves. The client
  // tweaks the greeting / project name / site line locally so rep edits
  // made in the form flow through to the outgoing draft.
  const service: any = rev.service ?? {};
  const wallBuildup: any = rev.wallBuildup ?? {};
  const resin = wallBuildup.resinId ? SEED_RESINS.find((r) => r.id === wallBuildup.resinId) : undefined;

  const mailtoBody = buildCustomerEmailBody({
    quoteNumber: rev.quote.number,
    customerCompany: customer.name,
    customerContact: customer.contactName,
    siteAddress: project?.siteAddress ?? null,
    projectName: project?.name ?? '(no project)',
    chemical: service.chemical ?? '',
    designTempF: service.designTempF,
    specificGravity: service.specificGravity,
    geometry: rev.geometry,
    resinName: resin?.name,
  });

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="send">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 5 of 5
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Customer &amp; Project
        </h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Confirm the recipient and project details before sending. Edits here
          update the customer and project records.
        </p>
      </header>

      <RecipientForm
        customerId={customer.id}
        customerName={customer.name}
        projectId={project?.id ?? null}
        quoteNumber={rev.quote.number}
        quoteId={quoteId}
        revLabel={revLabel}
        mailtoBody={mailtoBody}
        initial={{
          contactName:  customer.contactName ?? '',
          contactEmail: customer.contactEmail ?? '',
          contactPhone: customer.contactPhone ?? '',
          projectName:  project?.name ?? '',
          siteAddress:  project?.siteAddress ?? '',
          description:  project?.description ?? '',
        }}
      />
    </WizardShell>
  );
}
