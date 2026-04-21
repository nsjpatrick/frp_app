import Link from 'next/link';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

const STATUS_TINT: Record<string, string> = {
  DRAFT: 'glass-chip',
  SENT:  'glass-chip glass-tinted-slate',
  WON:   'glass-chip glass-tinted-emerald',
  LOST:  'glass-chip',
};

export default async function Dashboard() {
  const session = await auth();
  const user = session?.user as any;
  const quotes = await db.quote.findMany({
    where: { project: { customer: { tenantId: user.tenantId } } },
    include: { project: { include: { customer: true } }, revisions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Quotes</h1>
          <p className="text-[14px] text-slate-500 mt-0.5">
            Draft, sent, won, and lost quotes across all customers.
          </p>
        </div>
        <Link href="/quotes/new" className="btn-glass-prominent">
          <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          New quote
        </Link>
      </header>

      {quotes.length === 0 ? (
        <div className="glass p-12 text-center">
          <div className="text-4xl mb-3" aria-hidden>📝</div>
          <div className="text-[16px] font-semibold text-slate-900">No quotes yet</div>
          <p className="text-[13.5px] text-slate-500 mt-1.5 max-w-md mx-auto">
            Start a new quote to walk through the configurator. Pick a customer and project,
            then capture service conditions, geometry, and resin.
          </p>
          <Link href="/quotes/new" className="btn-glass-prominent mt-5 inline-flex">
            <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
            Start your first quote
          </Link>
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/60">
                <th className="px-5 py-3 font-semibold">Quote</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Project</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Rev</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t border-slate-200/40 hover:bg-white/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-[13px] text-slate-800">{q.number}</td>
                  <td className="px-5 py-3 text-slate-900">{q.project.customer.name}</td>
                  <td className="px-5 py-3 text-slate-700">{q.project.name}</td>
                  <td className="px-5 py-3">
                    <span className={STATUS_TINT[q.status] ?? 'glass-chip'}>{q.status}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">Rev {q.revisions[0]?.label ?? '—'}</td>
                  <td className="px-5 py-3 text-right">
                    {q.revisions[0] && (
                      <Link
                        href={`/quotes/${q.id}/rev/${q.revisions[0].label}/review`}
                        className="text-amber-700 hover:text-amber-900 text-[13px] font-medium"
                      >
                        Open →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
