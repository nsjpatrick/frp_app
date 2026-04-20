import Link from 'next/link';
import { listCustomers, createCustomer } from '@/lib/actions/customers';

export default async function Customers() {
  const customers = await listCustomers();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customers</h1>

      <form action={createCustomer} className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">New Customer</h2>
        <div className="grid grid-cols-2 gap-3">
          <input name="name" placeholder="Company name" required className="rounded border px-3 py-2" />
          <input name="contactName" placeholder="Contact name" className="rounded border px-3 py-2" />
          <input name="contactEmail" placeholder="Contact email" className="rounded border px-3 py-2" />
          <input name="contactPhone" placeholder="Contact phone" className="rounded border px-3 py-2" />
        </div>
        <button className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm">Create</button>
      </form>

      <table className="w-full bg-white border rounded">
        <thead className="text-left text-xs uppercase text-gray-500 border-b">
          <tr><th className="p-3">Name</th><th className="p-3">Contact</th><th className="p-3">Projects</th><th></th></tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-3">{c.name}</td>
              <td className="p-3 text-sm text-gray-600">{c.contactName ?? '—'}</td>
              <td className="p-3 text-sm">{c.projects.length}</td>
              <td className="p-3 text-right">
                <Link href={`/customers/${c.id}`} className="text-blue-600 text-sm">Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
