import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') return new NextResponse('forbidden', { status: 403 });
  const { email } = await req.json();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return new NextResponse('no user', { status: 404 });

  const session = await db.session.create({
    data: {
      sessionToken: crypto.randomUUID(),
      userId: user.id,
      expires: new Date(Date.now() + 3600_000),
    },
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('authjs.session-token', session.sessionToken, {
    httpOnly: true,
    path: '/',
    expires: session.expires,
  });
  return res;
}
