import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveServiceStep } from '@/lib/actions/revisions';
import { SiteLookupSection } from '@/components/wizard/SiteLookupSection';
import { TankTypeSelect } from '@/components/wizard/TankTypeSelect';
import { ChemistrySection } from '@/components/wizard/ChemistrySection';
import { RtpClassFields } from '@/components/wizard/RtpClassFields';
import { LivePricingSync } from '@/components/wizard/LivePricingSync';

export default async function Step1({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { customer: true, project: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== user.tenantId) notFound();

  const s: any = rev.service ?? {};
  const c: any = rev.certs ?? {};
  const w: any = rev.wallBuildup ?? {};
  // Start fresh quotes with structural fields empty so reps can't advance
  // past Step 1 on defaults. The postal-code lookup (or manual entry)
  // fills them in before the form will submit. Risk category + site class
  // have sensible defaults since they're categorical picks.
  const site: any = rev.site ?? {
    indoor: false,
    seismic: { siteClass: 'D', Ss: null, S1: null, Ie: 1.0, riskCategory: 'II' },
    wind: { V: null, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
  };

  const save = saveServiceStep.bind(null, quoteId, revLabel);

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-1">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 1 of 4
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Service Conditions &amp; Certifications
        </h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          What&apos;s being stored, at what conditions, and which codes must the vessel meet.
        </p>
      </header>

      <form action={save} className="space-y-9">
        <LivePricingSync />

        {/* ---------------------- Tank type ---------------------- */}
        <section>
          <h3 className="section-head">Tank Type</h3>
          <TankTypeSelect defaultValue={s.tankType} />
        </section>

        {/* ---------------------- Chemistry ---------------------- */}
        <ChemistrySection
          initial={{
            chemical: s.chemical ?? '',
            chemicalFamily: s.chemicalFamily ?? 'dilute_acid',
            concentrationPct: s.concentrationPct != null ? String(s.concentrationPct) : '',
            specificGravity: s.specificGravity != null ? String(s.specificGravity) : '1.0',
            postCure: !!s.postCure,
            resinId: w.resinId ?? '',
          }}
        />

        {/* ---------------------- Conditions ---------------------- */}
        <section>
          <h3 className="section-head">Operating Conditions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="glass-label" htmlFor="operatingTempF">Op temp (°F)</label>
              <input id="operatingTempF" type="number" step="any" name="operatingTempF"
                     defaultValue={s.operatingTempF ?? 80} required className="glass-input" />
            </div>
            <div>
              <label className="glass-label" htmlFor="designTempF">Design temp (°F)</label>
              <input id="designTempF" type="number" step="any" name="designTempF"
                     defaultValue={s.designTempF ?? 120} required className="glass-input" />
            </div>
            <div>
              <label className="glass-label" htmlFor="operatingPressurePsig">Op pressure (psig)</label>
              <input id="operatingPressurePsig" type="number" step="any" name="operatingPressurePsig"
                     defaultValue={s.operatingPressurePsig ?? 0} required className="glass-input" />
            </div>
            <div>
              <label className="glass-label" htmlFor="vacuumPsig">Vacuum (psig)</label>
              <input id="vacuumPsig" type="number" step="any" name="vacuumPsig"
                     defaultValue={s.vacuumPsig ?? 0} required className="glass-input" />
            </div>
          </div>
        </section>

        {/* ---------------------- Certifications ---------------------- */}
        <section>
          <h3 className="section-head">Certifications &amp; Inspection</h3>

          <RtpClassFields
            initialTankType={s.tankType}
            initialClass={c.asmeRtp1Class ?? ''}
            initialRevision={c.asmeRtp1StdRevision ?? 'RTP-1:2019'}
          />

          <div className="flex flex-wrap gap-2 mb-5">
            <label className="toggle-pill">
              <input type="checkbox" name="nsfAnsi61Required" defaultChecked={c.nsfAnsi61Required ?? false} />
              <span>NSF / ANSI 61</span>
              <span className="opacity-60 text-xs">potable water</span>
            </label>
            <label className="toggle-pill">
              <input type="checkbox" name="nsfAnsi2Required" defaultChecked={c.nsfAnsi2Required ?? false} />
              <span>NSF / ANSI 2</span>
              <span className="opacity-60 text-xs">food contact</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label className="glass-label" htmlFor="nsfAnsi61TargetTempF">NSF 61 target end-use temp (°F)</label>
              <input id="nsfAnsi61TargetTempF" type="number" step="any" name="nsfAnsi61TargetTempF"
                     defaultValue={c.nsfAnsi61TargetTempF ?? ''} className="glass-input" />
            </div>
            <div>
              <label className="glass-label" htmlFor="thirdPartyInspector">Third-party inspector</label>
              <select id="thirdPartyInspector" name="thirdPartyInspector"
                      defaultValue={c.thirdPartyInspector ?? 'NONE'} className="glass-input">
                <option value="NONE">None</option>
                <option value="TUV">TÜV</option>
                <option value="LLOYDS">Lloyd&apos;s</option>
                <option value="INTERTEK">Intertek</option>
              </select>
            </div>
          </div>

          <input type="hidden" name="ansiStandards" defaultValue={JSON.stringify(c.ansiStandards ?? [])} />
          <input type="hidden" name="requiredDocuments" defaultValue={JSON.stringify(c.requiredDocuments ?? [])} />
        </section>

        {/* ---------------------- Site & environment ---------------------- */}
        <section>
          <h3 className="section-head">Site &amp; Environmental</h3>
          <SiteLookupSection
            initial={site}
            defaultPostal={site?.postal?.code ?? ''}
            defaultCountry={site?.postal?.country ?? 'US'}
          />
        </section>

        {/* ---------------------- Action row ---------------------- */}
        <div className="flex justify-end pt-4 border-t border-slate-200/60">
          <button className="btn-glass-prominent !px-3" aria-label="Next step">
            <ChevronRight className="w-5 h-5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </form>
    </WizardShell>
  );
}
