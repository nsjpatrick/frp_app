import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveResinStep } from '@/lib/actions/revisions';
import { SEED_RESINS } from '@/lib/catalog/seed-data';
import { filterByChemistry } from '@/lib/rules/compatibility';
import { filterByCertifications } from '@/lib/rules/certification-filter';

export default async function Step4({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const service: any = rev.service ?? {};
  const certs: any = rev.certs ?? {};

  const afterChem = filterByChemistry(SEED_RESINS, service.chemicalFamily, service.designTempF);
  const eligible = filterByCertifications(afterChem, {
    asme_rtp1_class: certs.asmeRtp1Class ?? null,
    ansi_standards: certs.ansiStandards ?? [],
    nsf_ansi_61_required: !!certs.nsfAnsi61Required,
    nsf_ansi_61_target_temp_F: certs.nsfAnsi61TargetTempF,
    nsf_ansi_2_required: !!certs.nsfAnsi2Required,
  }, service.designTempF);

  const w: any = rev.wallBuildup ?? {};
  const save = saveResinStep.bind(null, quoteId, revLabel);

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-4">
      <h2 className="text-xl font-semibold mb-4">Resin & Wall Buildup</h2>

      {eligible.length === 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <strong>No eligible resin.</strong> The chemistry + certification combination eliminated all candidates from the V1 catalog. This revision will be flagged for engineering review.
        </div>
      ) : (
        <form action={save} className="space-y-4 text-sm">
          <p className="text-gray-500">{eligible.length} of {SEED_RESINS.length} catalog resins pass chemistry + certification filters.</p>
          <div className="space-y-2">
            {eligible.map((r) => (
              <label key={r.id} className="flex items-start gap-3 border rounded p-3 cursor-pointer hover:bg-gray-50">
                <input type="radio" name="resinId" value={r.id} defaultChecked={w.resinId === r.id} required />
                <div>
                  <div className="font-medium">{r.name} <span className="text-gray-500 font-normal">({r.supplier})</span></div>
                  <div className="text-xs text-gray-500">
                    Family: {r.family} · Max service temp: {r.max_service_temp_F}°F · ${r.price_per_lb.toFixed(2)}/lb
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="text-right">
            <button className="rounded bg-blue-600 text-white px-4 py-2 text-sm">Continue to review →</button>
          </div>
        </form>
      )}
    </WizardShell>
  );
}
