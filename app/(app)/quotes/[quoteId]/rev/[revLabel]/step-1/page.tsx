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
import { TankTypeDefaultsApplier } from '@/components/wizard/TankTypeDefaultsApplier';
import { QuantityInput } from '@/components/wizard/QuantityInput';
import { NsfToggles } from '@/components/wizard/NsfToggles';
import { FormKeyGuard } from '@/components/wizard/FormKeyGuard';

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
  const g: any = rev.geometry ?? {};
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
          Specifications, Service &amp; Certifications
        </h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Vessel size + operating envelope, what&apos;s being stored, and which codes must the vessel meet.
        </p>
      </header>

      <form action={save} className="space-y-9">
        <LivePricingSync />
        <TankTypeDefaultsApplier />
        <FormKeyGuard />

        {/* ---------------------- Tank type ---------------------- */}
        {/* Pinned to the very top — picking a tank type cascades defaults
            into every section below (chemistry, geometry, certs, accessories). */}
        <section>
          <h3 className="section-head">Tank Type</h3>
          <TankTypeSelect defaultValue={s.tankType} />
        </section>

        {/* ---------------------- Design Conditions ----------------------
             Vessel size + orientation + heads + operating envelope.
             Size inputs use feet for rep ergonomics — schema + pricing
             engine still work in inches; `saveServiceStep`, `LivePricingSync`,
             and `TankTypeDefaultsApplier` convert at the seam. */}
        <section>
          <h3 className="section-head">Design Conditions</h3>
          <p className="text-[12.5px] text-slate-500 mb-3 -mt-2">
            Vessel size, orientation, heads, and the operating envelope. Live pricing reacts on every keystroke.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label className="glass-label" htmlFor="orientation">Orientation</label>
              <select id="orientation" name="orientation" defaultValue={g.orientation ?? ''} required className="glass-input">
                <option value="" disabled>Select…</option>
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
              </select>
            </div>
            <div>
              <label className="glass-label" htmlFor="idFt">Diameter (ft)</label>
              <input id="idFt" type="number" step="any" name="idFt"
                     defaultValue={g.idIn != null ? Number((g.idIn / 12).toFixed(3)) : ''} required className="glass-input" placeholder="e.g. 8" />
            </div>
            <div>
              <label className="glass-label" htmlFor="ssHeightFt">Straight-side height (ft)</label>
              <input id="ssHeightFt" type="number" step="any" name="ssHeightFt"
                     defaultValue={g.ssHeightIn != null ? Number((g.ssHeightIn / 12).toFixed(3)) : ''} required className="glass-input" placeholder="e.g. 12" />
            </div>
            <div>
              <label className="glass-label" htmlFor="freeboardFt">Freeboard (ft)</label>
              {/* Per jobcalc convention 12″ (1 ft) of freeboard above the
                  liquid level is standard for atmospheric-service tanks. */}
              <input id="freeboardFt" type="number" step="any" name="freeboardFt"
                     defaultValue={g.freeboardIn != null ? Number((g.freeboardIn / 12).toFixed(3)) : 1} required className="glass-input" placeholder="e.g. 1" />
            </div>
            <div>
              <label className="glass-label" htmlFor="quantity">Quantity</label>
              <QuantityInput defaultValue={g.quantity ?? null} />
            </div>
          </div>

          {/* Heads & Bottom — moved here from Step 2 so vessel shape lives
              alongside size + orientation. The Sidewall toggle marks the
              vessel as single- or double-walled (integral secondary
              containment); pricing engine reads this via geometry.doubleWall. */}
          <div className="grid grid-cols-3 gap-4 items-end mt-4 pt-4 border-t border-slate-200/60">
            <div>
              <label className="glass-label" htmlFor="topHead">Top</label>
              <select id="topHead" name="topHead" defaultValue={g.topHead ?? 'F_AND_D'} className="glass-input">
                <option value="flat">Flat</option>
                <option value="F_AND_D">Dished</option>
                <option value="conical">Conical</option>
                <option value="open_top_cover">Open top w/ cover</option>
              </select>
            </div>
            <div>
              <label className="glass-label" htmlFor="bottom">Bottom</label>
              <select id="bottom" name="bottom" defaultValue={g.bottom ?? 'flat_ring_supported'} className="glass-input">
                <option value="flat_ring_supported">Flat with tie-down lugs</option>
                <option value="dished">Dished</option>
                <option value="conical_drain">Conical</option>
                <option value="sloped">Sloped</option>
              </select>
            </div>
            <div>
              <label className="glass-label" htmlFor="doubleWall">Sidewall</label>
              <label className="toggle-pill whitespace-nowrap">
                <input
                  id="doubleWall"
                  type="checkbox"
                  name="doubleWall"
                  defaultChecked={!!g.doubleWall}
                />
                <span>Double wall</span>
              </label>
            </div>
          </div>

          {/* Operating envelope. Defaults follow the jobcalc xls
              "atmospheric pressure" convention (Quote2 / NewText!B65):
              80°F ambient operating, 120°F design margin, 0 psig op
              pressure, 0 psig vacuum. Min ambient (HTD ΔT driver)
              defaults to 0 °F per the workbook's worst-case design.
              Reps override per service. */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end mt-4 pt-4 border-t border-slate-200/60">
            <div>
              <label className="glass-label" htmlFor="operatingTempF">Op temp (°F)</label>
              <input id="operatingTempF" type="number" step="any" name="operatingTempF"
                     defaultValue={s.operatingTempF ?? 80} required className="glass-input" placeholder="e.g. 80" />
            </div>
            <div>
              <label className="glass-label" htmlFor="designTempF">Design temp (°F)</label>
              <input id="designTempF" type="number" step="any" name="designTempF"
                     defaultValue={s.designTempF ?? 120} required className="glass-input" placeholder="e.g. 120" />
            </div>
            <div>
              <label className="glass-label" htmlFor="minAmbientTempF">Min ambient (°F)</label>
              <input id="minAmbientTempF" type="number" step="any" name="minAmbientTempF"
                     defaultValue={s.minAmbientTempF ?? 0} required className="glass-input" placeholder="0" />
            </div>
            <div>
              <label className="glass-label" htmlFor="operatingPressurePsig">Op pressure (psig)</label>
              <input id="operatingPressurePsig" type="number" step="any" name="operatingPressurePsig"
                     defaultValue={s.operatingPressurePsig ?? 0} required className="glass-input" placeholder="0" />
            </div>
            <div>
              <label className="glass-label" htmlFor="vacuumPsig">Vacuum (psig)</label>
              <input id="vacuumPsig" type="number" step="any" name="vacuumPsig"
                     defaultValue={s.vacuumPsig ?? 0} required className="glass-input" placeholder="0" />
            </div>
          </div>

          {/* Installation site + outer-shell color. Sourced from jobcalc
              Quote2!B28 (Location: Indoor / Outdoor) and Quote2!I20
              (Color: Wax / White / Grey / Other). The location toggle
              also drives ladder & handrail location defaults downstream. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end mt-4 pt-4 border-t border-slate-200/60">
            <div className="md:col-span-2">
              <label className="glass-label">Installation Location</label>
              <div className="flex gap-2">
                {(['outdoor', 'indoor'] as const).map((loc) => (
                  <label key={loc} className="toggle-pill flex-1 justify-center">
                    <input
                      type="radio"
                      name="installationLocation"
                      value={loc}
                      defaultChecked={(s.installationLocation ?? 'outdoor') === loc}
                    />
                    <span className="capitalize">{loc}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="glass-label" htmlFor="tankColor">Tank Color</label>
              <select id="tankColor" name="tankColor" defaultValue={s.tankColor ?? 'wax'} className="glass-input">
                <option value="wax">Wax (clear UV topcoat)</option>
                <option value="white">White gelcoat</option>
                <option value="grey">Grey gelcoat</option>
                <option value="other">Other (specify in quote notes)</option>
              </select>
            </div>
          </div>
        </section>

        {/* ---------------------- Chemistry ---------------------- */}
        <ChemistrySection
          initial={{
            chemical: s.chemical ?? '',
            chemicalFamily: s.chemicalFamily ?? '',
            concentrationPct: s.concentrationPct != null ? String(s.concentrationPct) : '',
            specificGravity: s.specificGravity != null ? String(s.specificGravity) : '',
            postCure: !!s.postCure,
            resinId: w.resinId ?? '',
            veilId:  w.veilId  ?? '',
          }}
        />

        {/* ---------------------- Certifications ---------------------- */}
        <section>
          <h3 className="section-head">Certifications</h3>
          <p className="text-[12.5px] text-slate-500 -mt-2 mb-3">
            Toggle each cert the vessel needs to meet. Defaults follow the tank-type pick — RTP-1 vessels start with Class II; Bryneer starts NSF 61; FRP layups default to ASTM D-3299/D-4097.
          </p>

          {/* RTP-1 first — owns its own class subselect via RtpClassFields. */}
          <RtpClassFields
            initialTankType={s.tankType}
            initialClass={c.asmeRtp1Class ?? ''}
            initialRevision={c.asmeRtp1StdRevision ?? 'RTP-1:2019'}
          />

          {/* NSF toggles — conditionally visible (Bryneer / hypochlorite). */}
          <NsfToggles
            initialTankType={s.tankType}
            initialChemicalFamily={s.chemicalFamily}
            initialChemical={s.chemical}
            initialNsf61={!!c.nsfAnsi61Required}
            initialNsf2={!!c.nsfAnsi2Required}
          />

          {/* Always-on cert toggles — ASTM layup specs + optional
              third-party stamps / listings. Defaults D-3299 + D-4097
              ON for FRP filament-wound + contact-molded heads. */}
          <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mt-4 mb-2">Layup specs &amp; documentation</div>
          <div className="flex flex-wrap gap-2">
            <label className="toggle-pill">
              <input type="checkbox" name="astmD3299" defaultChecked={c.astmD3299 ?? true} />
              <span>ASTM D-3299</span>
              <span className="opacity-60 text-xs">filament-wound</span>
            </label>
            <label className="toggle-pill">
              <input type="checkbox" name="astmD4097" defaultChecked={c.astmD4097 ?? true} />
              <span>ASTM D-4097</span>
              <span className="opacity-60 text-xs">contact-molded heads</span>
            </label>
            <label className="toggle-pill">
              <input type="checkbox" name="astmD5685" defaultChecked={c.astmD5685 ?? false} />
              <span>ASTM D-5685</span>
              <span className="opacity-60 text-xs">CMRP pressure</span>
            </label>
            <label className="toggle-pill">
              <input type="checkbox" name="peStamp" defaultChecked={c.peStamp ?? false} />
              <span>P.E. Stamp</span>
            </label>
            <label className="toggle-pill">
              <input type="checkbox" name="iccEsListed" defaultChecked={c.iccEsListed ?? false} />
              <span>ICC-ES Listed</span>
            </label>
          </div>

          {/* Inspector + ANSI/required-docs metadata — schema-only,
              kept hidden so persisted revisions parse cleanly. */}
          <input type="hidden" name="thirdPartyInspector" value={c.thirdPartyInspector ?? 'NONE'} />
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
