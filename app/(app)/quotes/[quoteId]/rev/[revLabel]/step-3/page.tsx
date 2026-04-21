import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveGeometryStep } from '@/lib/actions/revisions';

export default async function Step3({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const g: any = rev.geometry ?? {};
  const save = saveGeometryStep.bind(null, quoteId, revLabel);

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="step-3">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
          Step 3 of 5
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Geometry &amp; orientation</h2>
        <p className="text-slate-500 mt-1.5 text-[15px]">
          Overall vessel dimensions. Dimensions in inches; we convert as needed in engineering output.
        </p>
      </header>

      <form action={save} className="space-y-8">

        <section>
          <h3 className="section-head">Overall</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
          <h3 className="section-head">Heads &amp; bottom</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div className="flex justify-end pt-4 border-t border-slate-200/60">
          <button className="btn-glass-prominent">
            Save and continue
            <span aria-hidden>→</span>
          </button>
        </div>
      </form>
    </WizardShell>
  );
}
