import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect('/sign-in');

  return (
    <div className="pti-ambient">
      <Nav userEmail={session.user.email} />
      <main className="max-w-[1180px] mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
