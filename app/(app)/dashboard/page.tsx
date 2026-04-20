import Link from 'next/link';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Quotes</h1>
        <Link href="/customers" className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm">
          New customer
        </Link>
      </div>
      <table className="w-full bg-white border rounded">
        <thead className="text-left text-xs uppercase text-gray-500 border-b">
          <tr>
            <th className="p-3">Quote</th>
            <th className="p-3">Customer</th>
            <th className="p-3">Project</th>
            <th className="p-3">Status</th>
            <th className="p-3">Rev</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id} className="border-t">
              <td className="p-3 font-mono text-sm">{q.number}</td>
              <td className="p-3">{q.project.customer.name}</td>
              <td className="p-3">{q.project.name}</td>
              <td className="p-3">{q.status}</td>
              <td className="p-3">{q.revisions[0]?.label ?? '—'}</td>
              <td className="p-3 text-right">
                {q.revisions[0] && (
                  <Link href={`/quotes/${q.id}/rev/${q.revisions[0].label}/review`} className="text-blue-600 text-sm">
                    Open
                  </Link>
                )}
              </td>
            </tr>
          ))}
          {quotes.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-gray-500">
                No quotes yet. Start by creating a customer.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
