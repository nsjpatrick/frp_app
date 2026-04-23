'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ThemeMenu } from '@/components/ThemeMenu';

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
            {/* Two copies of the logomark, one for each theme. CSS in
                globals.css toggles `display` based on <html data-theme>,
                so the logo stroke matches the Nav's background without
                needing JS to sync on theme change. */}
            <Image
              src="/icon-light.svg"
              alt="PTI"
              width={379}
              height={356}
              className="h-8 w-8 object-contain nav-logo nav-logo-light"
              priority
            />
            <Image
              src="/icon-dark.svg"
              alt=""
              aria-hidden
              width={379}
              height={356}
              className="h-8 w-8 object-contain nav-logo nav-logo-dark"
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
          {/* Avatar doubles as a theme picker (System / Light / Dark).
              When a real profile menu ships this will either absorb these
              options or move theme selection elsewhere. */}
          <ThemeMenu userEmail={userEmail} />
        </div>
      </nav>
    </div>
  );
}
