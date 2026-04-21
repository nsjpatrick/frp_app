'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const LINKS = [
  { href: '/dashboard', label: 'Quotes' },
  { href: '/customers', label: 'Customers' },
];

export function Nav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-40 pt-4 px-4">
      <nav className="glass-raised flex items-center justify-between pl-3 pr-4 py-2.5 max-w-[1180px] mx-auto">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="flex items-center gap-2.5 pl-1">
            <Image
              src="/PTI_logo.png"
              alt="PTI"
              width={32}
              height={32}
              className="rounded-md"
              priority
            />
            <div className="leading-tight hidden sm:block">
              <div className="text-[13px] font-semibold tracking-tight">Plas-Tanks Industries</div>
              <div className="text-[11px] text-slate-500">FRP Tank Quoter</div>
            </div>
          </Link>
          <div className="flex items-center gap-1 ml-2">
            {LINKS.map((l) => {
              const active =
                l.href === '/dashboard'
                  ? pathname === '/dashboard' || pathname.startsWith('/quotes')
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    active
                      ? 'glass-tinted-amber'
                      : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden md:inline">{userEmail}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/sign-in' })}
            className="btn-glass text-[13px] px-3 py-1.5"
          >
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}
