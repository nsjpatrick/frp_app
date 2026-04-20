import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { saveServiceStep } from '@/lib/actions/revisions';
import { CHEMICAL_FAMILIES } from '@/lib/catalog/seed-data';
import { SiteLookupSection } from '@/components/wizard/SiteLookupSection';

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
      <h2 className="text-xl font-semibold mb-4">Service Conditions & Certifications</h2>
      <form action={save} className="space-y-6 text-sm">

        <section className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-gray-600">Chemical</span>
            <input name="chemical" defaultValue={s.chemical ?? ''} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Chemical family</span>
            <select name="chemicalFamily" defaultValue={s.chemicalFamily ?? 'dilute_acid'} className="w-full rounded border px-3 py-2">
              {CHEMICAL_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Concentration (%)</span>
            <input type="number" step="any" name="concentrationPct" defaultValue={s.concentrationPct ?? ''} className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Operating temp (°F)</span>
            <input type="number" step="any" name="operatingTempF" defaultValue={s.operatingTempF ?? 80} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Design temp (°F)</span>
            <input type="number" step="any" name="designTempF" defaultValue={s.designTempF ?? 120} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Specific gravity</span>
            <input type="number" step="any" name="specificGravity" defaultValue={s.specificGravity ?? 1.0} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Operating pressure (psig)</span>
            <input type="number" step="any" name="operatingPressurePsig" defaultValue={s.operatingPressurePsig ?? 0} required className="w-full rounded border px-3 py-2" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-600">Vacuum (psig)</span>
            <input type="number" step="any" name="vacuumPsig" defaultValue={s.vacuumPsig ?? 0} required className="w-full rounded border px-3 py-2" />
          </label>
        </section>

        <section>
          <h3 className="font-semibold mb-2">Certifications</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-gray-600">ASME RTP-1 class</span>
              <select name="asmeRtp1Class" defaultValue={c.asmeRtp1Class ?? ''} className="w-full rounded border px-3 py-2">
                <option value="">None</option>
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-gray-600">RTP-1 std revision</span>
              <input name="asmeRtp1StdRevision" defaultValue={c.asmeRtp1StdRevision ?? 'RTP-1:2019'} className="w-full rounded border px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 col-span-2">
              <input type="checkbox" name="nsfAnsi61Required" defaultChecked={c.nsfAnsi61Required ?? false} />
              <span>NSF / ANSI 61 required</span>
            </label>
            <label className="space-y-1">
              <span className="text-gray-600">NSF 61 target end-use temp (°F)</span>
              <input type="number" step="any" name="nsfAnsi61TargetTempF" defaultValue={c.nsfAnsi61TargetTempF ?? ''} className="w-full rounded border px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 col-span-2">
              <input type="checkbox" name="nsfAnsi2Required" defaultChecked={c.nsfAnsi2Required ?? false} />
              <span>NSF / ANSI 2 required</span>
            </label>
            <label className="space-y-1 col-span-2">
              <span className="text-gray-600">Third-party inspector</span>
              <select name="thirdPartyInspector" defaultValue={c.thirdPartyInspector ?? 'NONE'} className="w-full rounded border px-3 py-2">
                <option value="NONE">None</option>
                <option value="TUV">TÜV</option>
                <option value="LLOYDS">Lloyd&apos;s</option>
                <option value="INTERTEK">Intertek</option>
              </select>
            </label>
          </div>
          <input type="hidden" name="ansiStandards" defaultValue={JSON.stringify(c.ansiStandards ?? [])} />
          <input type="hidden" name="requiredDocuments" defaultValue={JSON.stringify(c.requiredDocuments ?? [])} />
        </section>

        <SiteLookupSection
          initial={site}
          siteAddress={rev.quote.project.siteAddress ?? ''}
        />

        <div className="text-right">
          <button className="rounded bg-blue-600 text-white px-4 py-2 text-sm">Save and continue →</button>
        </div>
      </form>
    </WizardShell>
  );
}
