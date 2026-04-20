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
      <h2 className="text-xl font-semibold mb-4">Geometry & Orientation</h2>
      <form action={save} className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-gray-600">Orientation</span>
            <select name="orientation" defaultValue={g.orientation ?? 'vertical'} className="w-full rounded border px-3 py-2">
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Inside Diameter (in)</span>
            <input type="number" step="any" name="idIn" defaultValue={g.idIn ?? 120} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Straight-side height (in)</span>
            <input type="number" step="any" name="ssHeightIn" defaultValue={g.ssHeightIn ?? 144} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Freeboard (in)</span>
            <input type="number" step="any" name="freeboardIn" defaultValue={g.freeboardIn ?? 12} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Top head</span>
            <select name="topHead" defaultValue={g.topHead ?? 'F_AND_D'} className="w-full rounded border px-3 py-2">
              <option value="flat">Flat</option>
              <option value="F_AND_D">Flanged & Dished</option>
              <option value="conical">Conical</option>
              <option value="open_top_cover">Open Top w/ Cover</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Bottom</span>
            <select name="bottom" defaultValue={g.bottom ?? 'flat_ring_supported'} className="w-full rounded border px-3 py-2">
              <option value="flat_ring_supported">Flat w/ support ring</option>
              <option value="dished">Dished</option>
              <option value="conical_drain">Conical drain</option>
              <option value="sloped">Sloped</option>
            </select>
          </label>
        </div>
        <div className="text-right">
          <button className="rounded bg-blue-600 text-white px-4 py-2 text-sm">Save and continue →</button>
        </div>
      </form>
    </WizardShell>
  );
}
