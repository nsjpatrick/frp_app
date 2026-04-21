'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, useTransition } from 'react';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [pendingMagic, startMagic] = useTransition();
  const [pendingDev, startDev] = useTransition();

  const handleMagic = (e: React.FormEvent) => {
    e.preventDefault();
    startMagic(async () => {
      await signIn('email', { email, redirect: false });
      setSent(true);
    });
  };

  const handleDev = () => {
    setDevError(null);
    startDev(async () => {
      const res = await fetch('/api/test/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || 'admin@frp-tank-quoter.local' }),
      });
      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setDevError(`${res.status} ${await res.text()}`);
      }
    });
  };

  return (
    <main className="pti-ambient min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="glass-raised p-3 rounded-3xl mb-5">
            <Image src="/PTI_logo.png" alt="PTI" width={56} height={56} className="rounded-xl" priority />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">Plas-Tanks Industries</h1>
          <p className="text-[13.5px] text-slate-500 mt-1">FRP Tank Quoter · Sign in</p>
        </div>

        <div className="glass-raised p-7 space-y-5">
          {sent ? (
            <div className="text-center py-6">
              <div className="text-2xl mb-3">📬</div>
              <div className="font-medium text-slate-900">Check your email</div>
              <p className="text-[13.5px] text-slate-500 mt-1 leading-relaxed">
                We sent a sign-in link to <strong className="text-slate-700">{email}</strong>.
              </p>
              <button
                onClick={() => setSent(false)}
                className="btn-glass text-[13px] mt-5"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleMagic} className="space-y-4">
                <div>
                  <label htmlFor="email" className="glass-label">Work email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="glass-input"
                    autoComplete="email"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pendingMagic || !email}
                  className="btn-glass-prominent w-full justify-center"
                >
                  {pendingMagic ? 'Sending…' : 'Send magic link'}
                </button>
              </form>

              {process.env.NODE_ENV !== 'production' && (
                <>
                  <div className="relative flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400">
                    <div className="flex-1 h-px bg-slate-300/60" />
                    <span>or</span>
                    <div className="flex-1 h-px bg-slate-300/60" />
                  </div>
                  <button
                    type="button"
                    onClick={handleDev}
                    disabled={pendingDev}
                    className="btn-glass w-full justify-center text-[13px]"
                  >
                    {pendingDev
                      ? 'Signing in…'
                      : email
                        ? `Dev: sign in as ${email}`
                        : 'Dev: sign in as seeded admin'}
                  </button>
                  {devError && (
                    <p className="text-[12px] text-red-700 text-center">{devError}</p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <p className="text-[11px] text-center text-slate-400 mt-6 leading-relaxed">
          Sales + Engineering portal · ISO 9001:2015 design records maintained
        </p>
      </div>
    </main>
  );
}
