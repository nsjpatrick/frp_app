import { auth } from '@/lib/auth';
import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Demo mode — `auth()` always resolves to the seeded demo admin. No
  // sign-in redirect: see lib/auth.ts for the stub and the note on how
  // to replace it before shipping real data.
  const session = await auth();

  return (
    <div className="pti-ambient">
      <Nav userEmail={session.user.email} />
      <main className="max-w-[1180px] mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
