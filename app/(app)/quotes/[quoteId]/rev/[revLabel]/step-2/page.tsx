import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveServiceStep } from '@/lib/actions/revisions';
import { CHEMICAL_FAMILIES, CHEMICAL_FAMILY_LABEL } from '@/lib/catalog/seed-data';
import { SiteLookupSection } from '@/components/wizard/SiteLookupSection';

// Display labels live in lib/catalog/seed-data.ts now (CHEMICAL_FAMILY_LABEL).

export default async function Step2({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const s: any = rev.service ?? {};
  const c: any = rev.certs ?? {};
  const site: any = rev.site ?? {
    indoor: false,
    seismic: { siteClass: 'D', Ss: 1.0, S1: 0.35, Ie: 1.0, riskCategory: 'II' },
    wind: { V: 115, exposure: 'C', Kzt: 1.0, riskCategory: 'II' },
  };

  const save = saveServiceStep.bind(null, quoteId, revLabel);

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-2">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 2 of 5
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Service Conditions &amp; Certifications
        </h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          What&apos;s being stored, at what conditions, and which codes must the vessel meet.
        </p>
      </header>

      <form action={save} className="space-y-9">

        {/* ---------------------- Chemistry ---------------------- */}
        <section>
          <h3 className="section-head">Chemistry</h3>
          {/* items-start so short-label cells don't stretch to match taller neighbors. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label className="glass-label" htmlFor="chemical">Chemical</label>
              <input
                id="chemical"
                name="chemical"
                defaultValue={s.chemical ?? ''}
                required
                placeholder="e.g. H₂SO₄, NaOH, NaOCl"
                className="glass-input"
              />
            </div>
            <div>
              <label className="glass-label" htmlFor="chemicalFamily">Chemical family</label>
              <select
                id="chemicalFamily"
                name="chemicalFamily"
                defaultValue={s.chemicalFamily ?? 'dilute_acid'}
                className="glass-input"
              >
                {CHEMICAL_FAMILIES.map((f) => (
                  <option key={f} value={f}>{CHEMICAL_FAMILY_LABEL[f] ?? f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="glass-label" htmlFor="concentrationPct">Concentration (%)</label>
              <input
                id="concentrationPct"
                type="number" step="any"
                name="concentrationPct"
                defaultValue={s.concentrationPct ?? ''}
                placeholder="50"
                className="glass-input"
              />
            </div>
            <div>
              <label className="glass-label" htmlFor="specificGravity">Specific gravity</label>
              <input
                id="specificGravity"
                type="number" step="any"
                name="specificGravity"
                defaultValue={s.specificGravity ?? 1.0}
                required
                className="glass-input"
              />
            </div>
          </div>

          {/* Optional thermal post-cure — heat treatment after layup to
              boost chemical resistance + temperature performance. Common
              for aggressive oxidizers, hot acids, solvents. */}
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <label className={`toggle-pill ${s.postCure ? 'on' : ''}`}>
              <input
                type="checkbox"
                name="postCure"
                defaultChecked={!!s.postCure}
              />
              <span>Post-Cure</span>
            </label>
            <span className="text-[13px] text-slate-500">
              Heat cure after layup (typ. 180–220°F) to improve chemical and thermal performance.
            </span>
          </div>
        </section>

        {/* ---------------------- Conditions ---------------------- */}
        <section>
          <h3 className="section-head">Operating Conditions</h3>
          {/* items-end so inputs bottom-align even when labels wrap to 2 lines on narrow viewports. */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 items-start">
            <div>
              <label className="glass-label" htmlFor="asmeRtp1Class">ASME RTP-1 class</label>
              <select
                id="asmeRtp1Class"
                name="asmeRtp1Class"
                defaultValue={c.asmeRtp1Class ?? ''}
                className="glass-input"
              >
                <option value="">— None —</option>
                <option value="I">Class I</option>
                <option value="II">Class II</option>
                <option value="III">Class III</option>
              </select>
            </div>
            <div>
              <label className="glass-label" htmlFor="asmeRtp1StdRevision">RTP-1 revision</label>
              <input id="asmeRtp1StdRevision" name="asmeRtp1StdRevision"
                     defaultValue={c.asmeRtp1StdRevision ?? 'RTP-1:2019'} className="glass-input" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <label className={`toggle-pill ${c.nsfAnsi61Required ? 'on' : ''}`}>
              <input type="checkbox" name="nsfAnsi61Required" defaultChecked={c.nsfAnsi61Required ?? false} />
              <span>NSF / ANSI 61</span>
              <span className="opacity-60 text-xs">potable water</span>
            </label>
            <label className={`toggle-pill ${c.nsfAnsi2Required ? 'on' : ''}`}>
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
            siteAddress={rev.quote.project.siteAddress ?? ''}
          />
        </section>

        {/* ---------------------- Action row ---------------------- */}
        <div className="flex justify-end pt-4 border-t border-slate-200/60">
          <button className="btn-glass-prominent">
            Next
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </form>
    </WizardShell>
  );
}
