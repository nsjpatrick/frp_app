import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { createProject } from '@/lib/actions/projects';

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user as any;
  const customer = await db.customer.findUnique({
    where: { id },
    include: { projects: { orderBy: { createdAt: 'desc' }, include: { quotes: { select: { id: true, number: true, status: true } } } } },
  });
  if (!customer || customer.tenantId !== user.tenantId) notFound();

  return (
    <div className="space-y-6">
      <div><Link href="/customers" className="text-sm text-blue-600">← Customers</Link></div>
      <h1 className="text-2xl font-semibold">{customer.name}</h1>
      <p className="text-gray-600">{customer.contactName} · {customer.contactEmail} · {customer.contactPhone}</p>

      <form action={createProject} className="bg-white border rounded p-4 space-y-3">
        <input type="hidden" name="customerId" value={customer.id} />
        <h2 className="font-semibold">New Project</h2>
        <div className="grid grid-cols-2 gap-3">
          <input name="name" placeholder="Project name" required className="rounded border px-3 py-2" />
          <input name="customerProjectNumber" placeholder="Customer PO #" className="rounded border px-3 py-2" />
          <input name="siteAddress" placeholder="Site address" className="rounded border px-3 py-2 col-span-2" />
          <input name="endUse" placeholder="End use" className="rounded border px-3 py-2 col-span-2" />
          <input type="date" name="needByDate" className="rounded border px-3 py-2" />
        </div>
        <button className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm">Create project</button>
      </form>

      <div>
        <h2 className="font-semibold mb-2">Projects</h2>
        <ul className="space-y-2">
          {customer.projects.map((p) => (
            <li key={p.id} className="bg-white border rounded p-3">
              <Link href={`/projects/${p.id}`} className="font-medium">{p.name}</Link>
              <span className="text-sm text-gray-500 ml-2">{p.quotes.length} quote(s)</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
