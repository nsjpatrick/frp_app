'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/quotes', label: 'Quotes' },
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
              src="/PTI_logo.svg"
              alt="PTI"
              width={379}
              height={356}
              className="h-8 w-8 object-contain"
              priority
            />
            <div className="leading-tight hidden sm:block">
              <div className="text-[13px] font-semibold tracking-tight">Plas-Tanks Industries</div>
              <div className="text-[11px] text-slate-500">FRP Tank Quoter</div>
            </div>
          </Link>
          <div className="flex items-center gap-1 ml-2">
            {LINKS.map((l) => {
              // Dashboard only matches exact path (otherwise /dashboard would
              // also highlight on /quotes). /quotes and /customers use
              // startsWith so their detail routes also show active state.
              const active =
                l.href === '/dashboard'
                  ? pathname === '/dashboard'
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
          {/* Avatar — placeholder for a profile menu. Human glyph for now;
              replaces the previous "Sign out" button. Menu wiring comes later. */}
          <button
            type="button"
            aria-label="Account menu"
            title={userEmail}
            // Opaque — no backdrop-filter. Nav is already .glass-raised; a nested
            // backdrop-blur disappears in Safari, so keep the avatar solid.
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 transition-colors"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(15,23,42,0.06)' }}
          >
            <User className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </nav>
    </div>
  );
}
