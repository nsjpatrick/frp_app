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
  const sa = json.structural_analysis;

  return (
    <WizardShell quoteId={quoteId} revLabel={revLabel} current="review">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-700 mb-2">
            Step 5 of 5
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Review &amp; generate</h2>
          <p className="text-slate-500 mt-1.5 text-[15px]">
            Final spec check before engineering handoff.
          </p>
        </div>
        <a
          href={`/quotes/${quoteId}/rev/${revLabel}/engineering.json`}
          className="btn-glass-prominent shrink-0"
        >
          <span aria-hidden>↓</span>
          Download Engineering JSON
        </a>
      </header>

      <div className="banner-review mb-6">
        <span className="text-xl leading-none shrink-0" aria-hidden>⚠</span>
        <div>
          <strong className="font-semibold">Preliminary — Engineering Review Required.</strong>
          <p className="text-[13.5px] leading-relaxed mt-0.5 opacity-90">
            Calculations produced per ASCE 7-22, ASTM D3299/D4097, and RTP-1.
            A licensed PE must review before release for fabrication.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card label="Customer / project">
          <div className="text-[15px] font-medium">{json.customer.name}</div>
          <div className="text-slate-600">{json.project.name}</div>
          <div className="text-slate-500 text-[13px] mt-1">{json.project.site_address ?? '—'}</div>
        </Card>

        <Card label="Service">
          <div className="text-[15px] font-medium">
            {json.service.chemical}
            <span className="text-slate-400 font-normal">
              {' '}({json.service.chemical_family})
            </span>
          </div>
          <div className="text-slate-600 text-[13px] mt-1">
            Op {json.service.operating_temp_F}°F · Design {json.service.design_temp_F}°F · SG {json.service.specific_gravity}
          </div>
        </Card>

        <Card label="Certifications">
          <div className="flex flex-wrap gap-1.5">
            {json.certifications.asme_rtp1 && (
              <span className="glass-chip glass-tinted-slate">
                RTP-1 Class {json.certifications.asme_rtp1.class}
              </span>
            )}
            {json.certifications.nsf_ansi_61.required && (
              <span className="glass-chip glass-tinted-emerald">NSF/ANSI 61</span>
            )}
            {json.certifications.nsf_ansi_2.required && (
              <span className="glass-chip glass-tinted-emerald">NSF/ANSI 2</span>
            )}
            {!json.certifications.asme_rtp1 &&
              !json.certifications.nsf_ansi_61.required &&
              !json.certifications.nsf_ansi_2.required && (
                <span className="text-[13px] text-slate-400">None selected</span>
              )}
            {json.certifications.third_party_inspector !== 'NONE' && (
              <span className="glass-chip">
                Inspector: {json.certifications.third_party_inspector}
              </span>
            )}
          </div>
        </Card>

        <Card label="Geometry">
          <div className="text-[15px] font-medium capitalize">{json.geometry.orientation}</div>
          <div className="text-slate-600 text-[13px] mt-1">
            {json.geometry.id_in}&quot; ID × {json.geometry.ss_height_in}&quot; SS<br/>
            Top {json.geometry.top_head.replace(/_/g, ' ')} · Bottom {json.geometry.bottom.replace(/_/g, ' ')}
          </div>
        </Card>

        <Card label="Resin" className="md:col-span-2">
          <div className="text-[15px] font-medium">
            {json.wall_buildup.corrosion_barrier.resin ?? (
              <span className="text-slate-400 font-normal">No resin selected</span>
            )}
          </div>
        </Card>
      </div>

      {sa && (
        <div className="glass-raised p-6 mb-6">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h3 className="section-head mb-0">Structural analysis (preliminary)</h3>
            <span className="glass-chip glass-tinted-amber text-[11px]">Review required</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric
              label="Shell thickness"
              value={`${sa.wallThickness.shellThicknessIn}″`}
              hint={`Governed by ${sa.wallThickness.governingRule.replace(/_/g, ' ')}`}
            />
            <Metric
              label="Head thickness"
              value={`${sa.wallThickness.headThicknessIn}″`}
              hint="1.15 × shell"
            />
            <Metric
              label="Wind base shear"
              value={`${sa.wind.baseShearLbf.toLocaleString()}`}
              suffix="lbf"
            />
            <Metric
              label="Seismic base shear"
              value={`${sa.seismic.baseShearLbf.toLocaleString()}`}
              suffix="lbf"
            />
            <Metric
              label="Governing case"
              value={sa.loadCombination.governingCase}
              hint={`Uplift ${sa.loadCombination.governingUpliftLbf.toLocaleString()} lbf`}
              wide
            />
            <Metric
              label="Anchor"
              value={`${sa.anchor.qty} × ${sa.anchor.anchorDetailId}`}
              hint={`${sa.anchor.selectedCapacityLbfEach.toLocaleString()} lbf each`}
              wide
            />
            <Metric
              label="Slosh freeboard"
              value={`${sa.seismic.requiredFreeboardIn}″ req`}
              hint={`${json.geometry.freeboard_in}″ provided`}
              wide
            />
          </div>
        </div>
      )}

      <details className="glass p-5">
        <summary className="cursor-pointer text-[13px] font-semibold text-slate-700 select-none">
          Engineering JSON preview
        </summary>
        <pre className="mt-3 text-[11px] text-slate-600 font-mono leading-relaxed overflow-auto max-h-[420px]">
{JSON.stringify(json, null, 2)}
        </pre>
      </details>
    </WizardShell>
  );
}

function Card({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass p-5 ${className ?? ''}`}>
      <div className="glass-label mb-2">{label}</div>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  suffix,
  wide,
}: {
  label: string;
  value: string;
  hint?: string;
  suffix?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-2' : ''}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </div>
      <div className="text-[20px] font-semibold tracking-tight text-slate-900 leading-tight">
        {value}
        {suffix && <span className="text-[13px] font-normal text-slate-500 ml-1">{suffix}</span>}
      </div>
      {hint && <div className="text-[12px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
