'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <div className="max-w-sm mx-auto pt-24 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {sent ? (
        <p className="text-sm">Check your email for a sign-in link.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await signIn('email', { email, redirect: false });
            setSent(true);
          }}
          className="space-y-3"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded border px-3 py-2"
          />
          <button type="submit" className="w-full rounded bg-blue-600 text-white py-2">
            Send magic link
          </button>
        </form>
      )}
    </div>
  );
}
