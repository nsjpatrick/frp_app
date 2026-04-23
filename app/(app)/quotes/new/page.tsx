import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { createQuote } from '@/lib/actions/quotes';
import { CustomerAutoSuggest } from '@/components/CustomerAutoSuggest';
import { NewCustomerQuoteModal } from '@/components/NewCustomerQuoteModal';
import { formatFormula } from '@/lib/format';

/**
 * New Quote — workflow entry point.
 *
 * Three-step intake (step 2 is optional):
 *   1. Customer — pick from existing, or spawn a new one via inline modal
 *      (the modal creates customer + quote + rev A in one shot).
 *   2. Project  — OPTIONAL. Sales often starts a quote before a project
 *      record exists, so "Continue without project" is first-class.
 *   3. Submit   — creates Quote + Revision A, redirects into wizard Step 1.
 *
 * Step state lives in the URL via `customerId` / `projectId` search params —
 * refreshable, shareable, and no client-side state needed.
 */

export default async function NewQuote({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; projectId?: string }>;
}) {
  const { customerId, projectId } = await searchParams;
  const session = await auth();
  const user = session?.user as any;
  if (!user?.tenantId) notFound();

  const customers = await db.customer.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: 'asc' },
    include: { projects: { select: { id: true, name: true, createdAt: true } } },
  });

  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : null;
  const selectedProject = selectedCustomer && projectId
    ? selectedCustomer.projects.find((p) => p.id === projectId)
    : null;

  const activeStep = selectedProject ? 3 : selectedCustomer ? 2 : 1;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <Link href="/quotes" className="text-[13px] text-slate-500 hover:text-slate-700">
          ← Back to Quotes
        </Link>
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900 mt-2">
          Start a New Quote
        </h1>
        <p className="text-[14px] text-slate-500 mt-1">
          Pick a customer. Projects are optional — you can attach one now or skip straight into the configurator.
        </p>
      </header>

      {/* Step breadcrumb */}
      <div className="glass p-3 flex items-center gap-2 text-[13px]">
        <StepDot n={1} label="Customer" active={activeStep >= 1} done={activeStep > 1} />
        <Connector done={activeStep > 1} />
        <StepDot n={2} label="Project (optional)" active={activeStep >= 2} done={activeStep > 2} />
        <Connector done={activeStep > 2} />
        <StepDot n={3} label="Configure" active={activeStep >= 3} done={false} />
      </div>

      {/* ------------------------------ Step 1: customer ------------------------------ */}
      <section className="glass-raised p-7 overflow-visible">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="section-head mb-0">① Customer</h2>
          {selectedCustomer && (
            <Link
              href="/quotes/new"
              className="text-[12px] text-slate-500 hover:text-slate-700"
            >
              Change
            </Link>
          )}
        </div>

        {selectedCustomer ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[16px] font-semibold text-slate-900">{selectedCustomer.name}</div>
              <div className="text-[13px] text-slate-500 mt-0.5">
                {selectedCustomer.contactName ?? '—'}
                {selectedCustomer.contactEmail ? ` · ${selectedCustomer.contactEmail}` : ''}
              </div>
            </div>
            <span className="glass-chip glass-tinted-emerald">✓ Selected</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[14px] text-slate-500 mb-4">
              No customers yet. Add one to start quoting.
            </p>
            <NewCustomerQuoteModal
              triggerLabel="+ New Customer"
              triggerClassName="btn-glass-prominent"
            />
          </div>
        ) : (
          <>
            <CustomerAutoSuggest
              customers={customers.map((c) => ({
                id: c.id,
                name: c.name,
                contactName: c.contactName,
                contactEmail: c.contactEmail,
                projectCount: c.projects.length,
              }))}
            />
            <div className="pt-4 mt-4 border-t border-slate-200/60 flex justify-between items-center">
              <span className="text-[12.5px] text-slate-500">Don&apos;t See Them?</span>
              <NewCustomerQuoteModal />
            </div>
          </>
        )}
      </section>

      {/* ------------------------------ Step 2: project (optional) ------------------------------ */}
      {selectedCustomer && (
        <section className="glass-raised p-7">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="section-head mb-0">② Project <span className="normal-case text-[11px] font-medium text-slate-400 ml-1">(optional)</span></h2>
            {selectedProject && (
              <Link
                href={`/quotes/new?customerId=${selectedCustomer.id}`}
                className="text-[12px] text-slate-500 hover:text-slate-700"
              >
                Change
              </Link>
            )}
          </div>

          {selectedProject ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[16px] font-semibold text-slate-900">{formatFormula(selectedProject.name)}</div>
                <div className="text-[13px] text-slate-500 mt-0.5">
                  Created {new Date(selectedProject.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span className="glass-chip glass-tinted-emerald">✓ Selected</span>
            </div>
          ) : (
            <>
              {selectedCustomer.projects.length === 0 ? (
                <p className="text-[13.5px] text-slate-500 mb-4">
                  {selectedCustomer.name} has no projects yet. You can skip ahead, or create one first.
                </p>
              ) : (
                <>
                  <p className="text-[12.5px] text-slate-500 mb-3">
                    Attach this quote to an existing project:
                  </p>
                  <ul className="space-y-2">
                    {selectedCustomer.projects.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/quotes/new?customerId=${selectedCustomer.id}&projectId=${p.id}`}
                          className="glass glass-interactive p-4 flex items-center justify-between gap-3 block"
                        >
                          <div className="min-w-0">
                            <div className="text-[15px] font-medium text-slate-900 truncate">{formatFormula(p.name)}</div>
                            <div className="text-[12.5px] text-slate-500 mt-0.5">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <span className="text-slate-400 shrink-0 text-[18px]" aria-hidden>→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Skip-project CTA — first-class path, not a tucked-away afterthought. */}
              <div className="pt-4 mt-4 border-t border-slate-200/60 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[13.5px] font-medium text-slate-700">No project? That&apos;s fine.</div>
                  <div className="text-[12px] text-slate-500 mt-0.5">
                    You can always attach one later from the quote detail page.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/customers/${selectedCustomer.id}`}
                    className="text-[12.5px] text-slate-500 hover:text-slate-700"
                  >
                    + New project
                  </Link>
                  <form action={createQuote}>
                    <input type="hidden" name="customerId" value={selectedCustomer.id} />
                    <button type="submit" className="btn-glass-prominent !px-3" aria-label="Continue without project">
                      <ChevronRight className="w-5 h-5" strokeWidth={2.5} aria-hidden />
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ------------------------------ Step 3: start configuring ------------------------------ */}
      {selectedCustomer && selectedProject && (
        <section className="glass-raised p-7">
          <h2 className="section-head mb-3">③ Ready to Configure</h2>
          <p className="text-[14px] text-slate-600 mb-5">
            We&apos;ll create a new quote (Rev A) for <strong>{formatFormula(selectedProject.name)}</strong> under{' '}
            <strong>{selectedCustomer.name}</strong>, then open the configurator so you can capture
            service conditions, certifications, geometry, and resin selection.
          </p>

          <form action={createQuote}>
            <input type="hidden" name="projectId" value={selectedProject.id} />
            <div className="flex items-center justify-end gap-3">
              <Link
                href={`/quotes/new?customerId=${selectedCustomer.id}`}
                className="text-[13px] text-slate-500 hover:text-slate-700"
              >
                Cancel
              </Link>
              <button type="submit" className="btn-glass-prominent !px-3" aria-label="Open configurator">
                <ChevronRight className="w-5 h-5" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function StepDot({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  const numStyle = done
    ? 'bg-gradient-to-b from-emerald-300 to-emerald-500 text-white border-emerald-700/40'
    : active
      ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-white border-amber-900/40 shadow-[0_4px_12px_-2px_rgba(217,119,6,0.5)]'
      : 'bg-white/70 text-slate-500 border-slate-200';
  return (
    <div className="flex items-center gap-2 px-1">
      <span
        className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold ${numStyle}`}
      >
        {done ? '✓' : n}
      </span>
      <span className={`font-medium ${active ? 'text-slate-900' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <div
      className={`flex-1 h-px ${done ? 'bg-emerald-400/60' : 'bg-slate-300/60'}`}
      aria-hidden
    />
  );
}
