import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveResinStep } from '@/lib/actions/revisions';
import { SEED_RESINS } from '@/lib/catalog/seed-data';
import { filterByChemistry } from '@/lib/rules/compatibility';
import { filterByCertifications } from '@/lib/rules/certification-filter';

const FAMILY_LABEL: Record<string, string> = {
  vinyl_ester: 'Vinyl ester',
  bis_a_epoxy: 'Bisphenol-A epoxy',
  iso_polyester: 'Isophthalic polyester',
  novolac: 'Novolac',
};

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
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 4 of 5
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Resin &amp; wall buildup</h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Candidates filtered by chemistry, design temperature, and selected certifications.
        </p>
      </header>

      {eligible.length === 0 ? (
        <div className="banner-review">
          <span className="shrink-0 text-xl leading-none" aria-hidden>⚠</span>
          <div>
            <strong className="font-semibold">No eligible resin.</strong>
            <p className="mt-1 text-[14px] leading-relaxed">
              The chemistry + certification combination eliminated all candidates from the V1 catalog.
              This revision will be flagged for engineering review.
            </p>
          </div>
        </div>
      ) : (
        <form action={save} className="space-y-6">
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <span className="glass-chip glass-tinted-emerald">
              {eligible.length} of {SEED_RESINS.length} pass filters
            </span>
            <span className="text-slate-400">· chemistry + certifications + design temp</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {eligible.map((r, idx) => {
              const checked = w.resinId === r.id || (idx === 0 && !w.resinId);
              return (
                <label
                  key={r.id}
                  className={`glass glass-interactive hover-lift p-5 cursor-pointer flex items-start gap-4 ${
                    checked ? 'ring-2 ring-amber-400/60' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="resinId"
                    value={r.id}
                    defaultChecked={checked}
                    required
                    className="mt-1.5 w-4 h-4 accent-amber-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <div className="text-[16px] font-semibold tracking-tight">
                        {r.name}
                      </div>
                      <div className="text-[13px] text-slate-500">{r.supplier}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      <span className="glass-chip">{FAMILY_LABEL[r.family] ?? r.family}</span>
                      <span className="glass-chip">Max {r.max_service_temp_F}°F</span>
                      <span className="glass-chip">${r.price_per_lb.toFixed(2)}/lb</span>
                      {r.certifications.nsf_ansi_61.listed && (
                        <span className="glass-chip glass-tinted-emerald">
                          NSF 61 to {r.certifications.nsf_ansi_61.max_temp_F}°F
                        </span>
                      )}
                      {r.certifications.nsf_ansi_2.listed && (
                        <span className="glass-chip glass-tinted-emerald">NSF 2</span>
                      )}
                      {r.certifications.asme_rtp1_class_eligibility.length > 0 && (
                        <span className="glass-chip glass-tinted-slate">
                          RTP-1 {r.certifications.asme_rtp1_class_eligibility.join('/')}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200/60">
            <button className="btn-glass-prominent">
              Continue to review
              <span aria-hidden>→</span>
            </button>
          </div>
        </form>
      )}
    </WizardShell>
  );
}
