import Link from 'next/link';

export function Nav({ userEmail }: { userEmail: string }) {
  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-semibold">FRP Tank Quoter</Link>
        <Link href="/customers" className="text-sm text-gray-700">Customers</Link>
        <Link href="/dashboard" className="text-sm text-gray-700">Quotes</Link>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{userEmail}</span>
      </div>
    </nav>
  );
}
