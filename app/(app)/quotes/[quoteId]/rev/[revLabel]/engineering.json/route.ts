import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildEngineeringJson } from '@/lib/outputs/engineering-json';
import { RULES_ENGINE_VERSION } from '@/lib/rules';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ quoteId: string; revLabel: string }> },
) {
  const { quoteId, revLabel } = await params;

  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const rev = await db.revision.findUnique({
    where: { quoteId_label: { quoteId, label: revLabel } },
    include: { quote: { include: { project: { include: { customer: true } } } } },
  });
  if (!rev || rev.quote.project.customer.tenantId !== user.tenantId) {
    return new NextResponse('Not found', { status: 404 });
  }

  const json = buildEngineeringJson(
    { quote: rev.quote, revision: rev } as any,
    { rulesEngineVersion: RULES_ENGINE_VERSION, catalogSnapshotId: 'seed-v0' },
  );

  return NextResponse.json(json, {
    headers: { 'Content-Disposition': `attachment; filename="${rev.quote.number}-Rev${rev.label}.json"` },
  });
}
