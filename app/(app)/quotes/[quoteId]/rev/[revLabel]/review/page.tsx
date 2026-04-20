import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { WizardShell } from '@/components/wizard/WizardShell';
import { buildEngineeringJson } from '@/lib/outputs/engineering-json';
import { RULES_ENGINE_VERSION } from '@/lib/rules';

export default async function Review({ params }: { params: Promise<{ quoteId: string; revLabel: string }> }) {
  const { quoteId, revLabel } = await params;
  const session = await auth();
  const user = session?.user as any;
  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) notFound();

  const json = buildEngineeringJson(
    { quote: rev.quote, revision: rev } as any,
    { rulesEngineVersion: RULES_ENGINE_VERSION, catalogSnapshotId: 'seed-v0' },
  );

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="review">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Review & Generate</h2>
        <a
          href={`/quotes/${quoteId}/rev/${revLabel}/engineering.json`}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm"
        >
          Download Engineering JSON
        </a>
      </div>

      <div className="space-y-4 text-sm">
        <section>
          <h3 className="font-semibold">Customer / Project</h3>
          <div className="text-gray-700">{json.customer.name} · {json.project.name} · {json.project.site_address ?? '—'}</div>
        </section>

        <section>
          <h3 className="font-semibold">Service</h3>
          <div className="text-gray-700">
            {json.service.chemical} ({json.service.chemical_family})
            · Op {json.service.operating_temp_F}°F / Design {json.service.design_temp_F}°F
            · SG {json.service.specific_gravity}
          </div>
        </section>

        <section>
          <h3 className="font-semibold">Certifications</h3>
          <div className="text-gray-700">
            {json.certifications.asme_rtp1 ? `ASME RTP-1 Class ${json.certifications.asme_rtp1.class}` : 'No ASME RTP-1'}
            {' · '}
            {json.certifications.nsf_ansi_61.required ? 'NSF/ANSI 61' : '—'}
            {' · '}
            {json.certifications.nsf_ansi_2.required ? 'NSF/ANSI 2' : '—'}
          </div>
        </section>

        <section>
          <h3 className="font-semibold">Geometry</h3>
          <div className="text-gray-700">
            {json.geometry.orientation} · {json.geometry.id_in}&quot; ID × {json.geometry.ss_height_in}&quot; SS ·
            top {json.geometry.top_head} · bottom {json.geometry.bottom}
          </div>
        </section>

        <section>
          <h3 className="font-semibold">Resin</h3>
          <div className="text-gray-700">{json.wall_buildup.corrosion_barrier.resin ?? 'None selected'}</div>
        </section>

        <section>
          <h3 className="font-semibold">JSON Preview</h3>
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-[400px]">
{JSON.stringify(json, null, 2)}
          </pre>
        </section>
      </div>
    </WizardShell>
  );
}
