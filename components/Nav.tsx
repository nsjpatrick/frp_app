'use client';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

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
        <button onClick={() => signOut()} className="text-sm text-gray-700 underline">
          Sign out
        </button>
      </div>
    </nav>
  );
}
