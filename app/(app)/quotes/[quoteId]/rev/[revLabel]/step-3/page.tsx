import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveResinStep } from '@/lib/actions/revisions';
import { SEED_RESINS, CHEMICAL_FAMILY_LABEL } from '@/lib/catalog/seed-data';
import type { ChemicalFamily } from '@/lib/catalog/seed-data';
import { filterByChemistry } from '@/lib/rules/compatibility';
import { filterByCertifications } from '@/lib/rules/certification-filter';

const FAMILY_LABEL: Record<string, string> = {
  vinyl_ester: 'Vinyl Ester',
  bis_a_epoxy_ve: 'Bisphenol-A Epoxy VE',
  novolac_epoxy_ve: 'Novolac Epoxy VE',
  iso_polyester: 'Isophthalic Polyester',
  ortho_polyester: 'Orthophthalic Polyester',
  chlorendic_polyester: 'Chlorendic Polyester',
  bpa_fumarate: 'BPA Fumarate Polyester',
  elastomer_modified: 'Elastomer-Modified VE',
};

export default async function Step3({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { customer: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== user.tenantId) notFound();

  const service: any = rev.service ?? {};
  const certs: any = rev.certs ?? {};

  // We run the filters progressively so we can tell the rep *which* filter
  // eliminated the last candidate when zero pass. Silent "no resins
  // available" is the most common footgun in this step — it almost always
  // means the chemicalFamily guess was wrong, the design temp is out of
  // the V1 catalog's envelope, or a cert requirement has no overlap.
  const certReqs = {
    asme_rtp1_class: certs.asmeRtp1Class ?? null,
    ansi_standards: certs.ansiStandards ?? [],
    nsf_ansi_61_required: !!certs.nsfAnsi61Required,
    nsf_ansi_61_target_temp_F: certs.nsfAnsi61TargetTempF,
    nsf_ansi_2_required: !!certs.nsfAnsi2Required,
  };

  const serviceIncomplete =
    !service.chemicalFamily || service.designTempF == null;

  // Isolate the temp filter from the chemistry-family filter so the zero-
  // state can tell them apart. `filterByChemistry` combines both today;
  // we emulate each half here.
  const byFamilyOnly = service.chemicalFamily
    ? SEED_RESINS.filter((r) =>
        r.compatible_chemical_families.includes(service.chemicalFamily as ChemicalFamily),
      )
    : [];
  const byFamilyAndTemp = byFamilyOnly.filter(
    (r) => r.max_service_temp_F >= (service.designTempF ?? 0),
  );
  const afterChem = byFamilyAndTemp;
  const eligible = filterByCertifications(afterChem, certReqs, service.designTempF);

  const w: any = rev.wallBuildup ?? {};
  const save = saveResinStep.bind(null, quoteId, revLabel);

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-3">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 3 of 5
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Resin &amp; Wall Buildup</h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Candidates filtered by chemistry, design temperature, and selected certifications.
        </p>
      </header>

      {eligible.length === 0 ? (
        <ZeroStateDiagnostic
          quoteId={quoteId}
          revLabel={revLabel}
          serviceIncomplete={serviceIncomplete}
          chemicalFamily={service.chemicalFamily as ChemicalFamily | undefined}
          designTempF={service.designTempF}
          byFamilyOnly={byFamilyOnly.length}
          byFamilyAndTemp={byFamilyAndTemp.length}
          afterCerts={eligible.length}
          certReqs={certReqs}
        />
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
                  className={`bg-white/85 border border-slate-200/60 rounded-2xl p-5 cursor-pointer flex items-start gap-4 transition-all hover:bg-white hover:-translate-y-0.5 ${
                    checked ? 'ring-2 ring-amber-400/60' : ''
                  }`}
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.03)' }}
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
            <button className="btn-glass-prominent !px-3" aria-label="Next step">
              <ChevronRight className="w-5 h-5" strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </form>
      )}
    </WizardShell>
  );
}

/**
 * Zero-state diagnostic. Tells the rep which filter emptied the candidate
 * list so they know which control to relax. Three distinct cases:
 *   a) Service inputs missing → send them back to Step 1.
 *   b) Chemistry family itself matches zero resins at the design temp.
 *      Typically means the temp is above the V1 catalog's envelope, or
 *      the family was auto-chosen wrong. We show the current family +
 *      the temp and a link back to Step 1.
 *   c) Chemistry + temp match some resins, but the cert requirements
 *      eliminated the rest. We show which cert is the culprit and a
 *      link back to the cert section.
 */
function ZeroStateDiagnostic({
  quoteId,
  revLabel,
  serviceIncomplete,
  chemicalFamily,
  designTempF,
  byFamilyOnly,
  byFamilyAndTemp,
  certReqs,
}: {
  quoteId: string;
  revLabel: string;
  serviceIncomplete: boolean;
  chemicalFamily: ChemicalFamily | undefined;
  designTempF: number | null | undefined;
  byFamilyOnly: number;
  byFamilyAndTemp: number;
  afterCerts: number;
  certReqs: {
    asme_rtp1_class: string | null;
    nsf_ansi_61_required: boolean;
    nsf_ansi_61_target_temp_F?: number;
    nsf_ansi_2_required: boolean;
  };
}) {
  const step1 = `/quotes/${quoteId}/rev/${revLabel}/step-1`;
  const familyLabel = chemicalFamily ? CHEMICAL_FAMILY_LABEL[chemicalFamily] ?? chemicalFamily : '—';

  let body: React.ReactNode;
  if (serviceIncomplete) {
    body = (
      <>
        <strong className="font-semibold">Service Conditions Missing.</strong>
        <p className="mt-1 text-[14px] leading-relaxed">
          We need a chemical family and design temperature before the resin list can filter.
          {' '}
          <Link href={step1} className="text-amber-700 font-medium underline-offset-2 hover:underline">
            Finish Step 1
          </Link> and come back.
        </p>
      </>
    );
  } else if (byFamilyOnly === 0) {
    body = (
      <>
        <strong className="font-semibold">No resins compatible with {familyLabel}.</strong>
        <p className="mt-1 text-[14px] leading-relaxed">
          The V1 catalog doesn&apos;t include a resin rated for this family.
          Double-check the chemical name in <Link href={step1} className="text-amber-700 font-medium underline-offset-2 hover:underline">Step 1</Link> — a different family (for example <em>Concentrated Acid</em> vs <em>Dilute Acid</em>) often unblocks the list.
        </p>
      </>
    );
  } else if (byFamilyAndTemp === 0) {
    body = (
      <>
        <strong className="font-semibold">Design temp {designTempF}°F exceeds every {familyLabel} resin.</strong>
        <p className="mt-1 text-[14px] leading-relaxed">
          {byFamilyOnly} resin{byFamilyOnly === 1 ? '' : 's'} match the chemistry but none are rated to {designTempF}°F.
          Drop the design temperature in <Link href={step1} className="text-amber-700 font-medium underline-offset-2 hover:underline">Step 1</Link>, or escalate — a specialty resin outside the V1 catalog may apply.
        </p>
      </>
    );
  } else {
    const culprits: string[] = [];
    if (certReqs.nsf_ansi_61_required) culprits.push('NSF/ANSI 61');
    if (certReqs.nsf_ansi_2_required) culprits.push('NSF/ANSI 2');
    if (certReqs.asme_rtp1_class) culprits.push(`ASME RTP-1 Class ${certReqs.asme_rtp1_class}`);
    const list = culprits.length > 0 ? culprits.join(' + ') : 'the selected certifications';
    body = (
      <>
        <strong className="font-semibold">Certifications eliminated every candidate.</strong>
        <p className="mt-1 text-[14px] leading-relaxed">
          {byFamilyAndTemp} resin{byFamilyAndTemp === 1 ? '' : 's'} pass the chemistry + design-temp filters, but none carry {list}.
          Relax or remove one of those requirements in <Link href={step1} className="text-amber-700 font-medium underline-offset-2 hover:underline">Step 1 → Certifications</Link> to continue, or escalate for a specialty resin.
        </p>
      </>
    );
  }

  return (
    <div className="banner-review">
      <span className="shrink-0 text-xl leading-none" aria-hidden>⚠</span>
      <div>
        {body}
      </div>
    </div>
  );
}
