import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { ProjectDetailClient } from '@/components/ProjectDetailClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: project
      ? `${project.name} | JobCalc Neo`
      : 'Project | JobCalc Neo',
  };
}

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user as any;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      customer: true,
      quotes: {
        orderBy: { updatedAt: 'desc' },
        include: {
          revisions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              label: true,
              service: true,
              geometry: true,
              wallBuildup: true,
            },
          },
        },
      },
    },
  });
  if (!project || project.customer.tenantId !== user.tenantId) notFound();

  // Shape the data for the client: simple plain objects, strip dates → ISO.
  const serialized = {
    id: project.id,
    name: project.name,
    description: project.description,
    siteAddress: project.siteAddress,
    endUse: project.endUse,
    needByDate: project.needByDate ? project.needByDate.toISOString() : null,
    createdAt: project.createdAt.toISOString(),
    customer: {
      id: project.customer.id,
      name: project.customer.name,
    },
    quotes: project.quotes.map((q) => ({
      id: q.id,
      number: q.number,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
      revision: q.revisions[0]
        ? {
            label: q.revisions[0].label,
            service: (q.revisions[0].service as any) ?? null,
            geometry: (q.revisions[0].geometry as any) ?? null,
            wallBuildup: (q.revisions[0].wallBuildup as any) ?? null,
          }
        : null,
    })),
  };

  return <ProjectDetailClient project={serialized} />;
}
