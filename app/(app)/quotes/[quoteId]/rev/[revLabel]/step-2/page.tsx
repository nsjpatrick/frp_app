import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveGeometryStep } from '@/lib/actions/revisions';
import { NozzleSchedule } from '@/components/wizard/NozzleSchedule';

const STAINLESS_LABEL: Array<[string, string]> = [
  ['SS304',           '304'],
  ['SS304L',          '304L'],
  ['SS316',           '316'],
  ['SS316L',          '316L'],
  ['SS2205_DUPLEX',   '2205 Duplex'],
  ['SS904L',          '904L (High-Moly)'],
  ['SS321',           '321 (Ti-Stabilized)'],
  ['SS17_4PH',        '17-4 PH (Precipitation-Hardened)'],
];

export default async function Step2({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { customer: true } } },
  });
  if (!rev || rev.quote.customer.tenantId !== user.tenantId) notFound();

  const g: any = rev.geometry ?? {};
  const save = saveGeometryStep.bind(null, quoteId, revLabel);

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-2">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 2 of 5
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Geometry &amp; Orientation</h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Overall vessel dimensions. Dimensions in inches; we convert as needed in engineering output.
        </p>
      </header>

      <form action={save} className="space-y-8">

        <section>
          <h3 className="section-head">Overall</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="glass-label">Orientation</label>
              <select name="orientation" defaultValue={g.orientation ?? 'vertical'} className="glass-input">
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
              </select>
            </div>
            <div>
              <label className="glass-label">Inside diameter (in)</label>
              <input type="number" step="any" name="idIn" defaultValue={g.idIn ?? 120} required className="glass-input" />
            </div>
            <div>
              <label className="glass-label">Straight-side height (in)</label>
              <input type="number" step="any" name="ssHeightIn" defaultValue={g.ssHeightIn ?? 144} required className="glass-input" />
            </div>
            <div>
              <label className="glass-label">Freeboard (in)</label>
              <input type="number" step="any" name="freeboardIn" defaultValue={g.freeboardIn ?? 12} required className="glass-input" />
            </div>
          </div>
        </section>

        <section>
          <h3 className="section-head">Heads &amp; Bottom</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label className="glass-label">Top head</label>
              <select name="topHead" defaultValue={g.topHead ?? 'F_AND_D'} className="glass-input">
                <option value="flat">Flat</option>
                <option value="F_AND_D">Flanged &amp; dished</option>
                <option value="conical">Conical</option>
                <option value="open_top_cover">Open top w/ cover</option>
              </select>
            </div>
            <div>
              <label className="glass-label">Bottom</label>
              <select name="bottom" defaultValue={g.bottom ?? 'flat_ring_supported'} className="glass-input">
                <option value="flat_ring_supported">Flat w/ support ring</option>
                <option value="dished">Dished</option>
                <option value="conical_drain">Conical drain</option>
                <option value="sloped">Sloped</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="section-head">Nozzles &amp; Connections</h3>
          <p className="text-[13px] text-slate-500 mb-3 -mt-2">
            Inlets, outlets, manways, vents, and instrument ports.
          </p>
          <NozzleSchedule initial={Array.isArray(g.nozzles) ? g.nozzles : []} />
        </section>

        <section>
          <h3 className="section-head">Interior Baffles</h3>
          <p className="text-[13px] text-slate-500 mb-3 -mt-2">
            Common in agitated or mixed-flow service.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className={`toggle-pill ${g.baffles ? 'on' : ''}`}>
              <input
                type="checkbox"
                name="baffles"
                defaultChecked={!!g.baffles}
              />
              <span>Include Baffles</span>
            </label>
            <input
              type="number"
              min={0}
              step={1}
              name="baffleCount"
              defaultValue={g.baffleCount ?? 4}
              className="glass-input w-[96px]"
              placeholder="4"
              aria-label="Number of baffles"
            />
          </div>
        </section>

        <section>
          <h3 className="section-head">Stainless-Steel Stand</h3>
          <p className="text-[13px] text-slate-500 mb-3 -mt-2">
            Structural SS stand or skirt in place of a concrete pad.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className={`toggle-pill ${g.stainlessStand ? 'on' : ''}`}>
              <input
                type="checkbox"
                name="stainlessStand"
                defaultChecked={!!g.stainlessStand}
              />
              <span>Include Stand</span>
            </label>
            <select
              name="stainlessGrade"
              defaultValue={g.stainlessGrade ?? 'SS316'}
              className="glass-input w-[240px]"
              aria-label="Stainless grade"
            >
              {STAINLESS_LABEL.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </section>

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
