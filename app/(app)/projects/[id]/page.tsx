import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { createQuote } from '@/lib/actions/quotes';

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user as any;
  const project = await db.project.findUnique({
    where: { id },
    include: { customer: true, quotes: { include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
  });
  if (!project || project.customer.tenantId !== user.tenantId) notFound();

  return (
    <div className="space-y-6">
      <div><Link href={`/customers/${project.customerId}`} className="text-sm text-blue-600">← {project.customer.name}</Link></div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <form action={createQuote}>
          <input type="hidden" name="projectId" value={project.id} />
          <button className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm">New quote</button>
        </form>
      </div>

      <p className="text-gray-600">{project.siteAddress}</p>

      <div>
        <h2 className="font-semibold mb-2">Quotes</h2>
        <ul className="space-y-2">
          {project.quotes.map((q) => (
            <li key={q.id} className="bg-white border rounded p-3 flex justify-between">
              <div>
                <div className="font-mono">{q.number}</div>
                <div className="text-sm text-gray-500">Rev {q.revisions[0]?.label ?? '—'} · {q.status}</div>
              </div>
              {q.revisions[0] && (
                <Link href={`/quotes/${q.id}/rev/${q.revisions[0].label}/step-1`} className="text-blue-600 text-sm self-center">Open</Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
