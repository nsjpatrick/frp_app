import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect('/sign-in');

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav userEmail={session.user.email} />
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
