'use server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { QuoteStatus } from '@prisma/client';

async function getUser() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) throw new Error('unauthenticated');
  return user;
}

function quoteNumber(): string {
  const y = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `Q-${y}-${rand}`;
}

/**
 * Create a new Quote (+ Revision A) and redirect into the wizard.
 *
 * Accepts either `projectId` (existing flow) or `customerId` (project-less
 * quote). When both are given, projectId wins and customerId is re-derived
 * from the project to guarantee consistency.
 */
export async function createQuote(formData: FormData) {
  const user = await getUser();

  const projectIdRaw = formData.get('projectId');
  const customerIdRaw = formData.get('customerId');
  const projectId = projectIdRaw ? String(projectIdRaw) : null;
  let customerId = customerIdRaw ? String(customerIdRaw) : null;

  if (!projectId && !customerId) {
    throw new Error('customerId or projectId required');
  }

  // Resolve + tenant-check both the customer and (optional) project.
  if (projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { customer: true },
    });
    if (!project || project.customer.tenantId !== user.tenantId) {
      throw new Error('project not found');
    }
    customerId = project.customerId;
  } else {
    const customer = await db.customer.findUnique({ where: { id: customerId! } });
    if (!customer || customer.tenantId !== user.tenantId) {
      throw new Error('customer not found');
    }
  }

  const quote = await db.quote.create({
    data: {
      projectId,
      customerId: customerId!,
      number: quoteNumber(),
    },
  });

  const rev = await db.revision.create({
    data: { quoteId: quote.id, label: 'A' },
  });

  await writeAuditEntry(db, {
    entityType: 'Quote',
    entityId: quote.id,
    revisionId: rev.id,
    actorUserId: user.id,
    action: 'create',
    diffJson: { number: quote.number, projectId, customerId },
  });

  redirect(`/quotes/${quote.id}/rev/${rev.label}/step-1`);
}

// ---------------------------------------------------------------------------
// Row-level actions used by the quotes table's 3-dot menu.
// ---------------------------------------------------------------------------

async function loadQuoteForTenant(quoteId: string, tenantId: string) {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { customer: true, revisions: { orderBy: { label: 'desc' }, take: 1 } },
  });
  if (!quote || quote.customer.tenantId !== tenantId) throw new Error('quote not found');
  return quote;
}

// A, B, C, …, Z. If we somehow exceed Z we wrap back to AA, AB, … — unlikely
// in practice but keeps the label monotonic instead of blowing up.
function nextRevisionLabel(current: string): string {
  const trimmed = current.trim();
  if (!trimmed) return 'A';
  const last = trimmed[trimmed.length - 1];
  if (last >= 'A' && last < 'Z') {
    return trimmed.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
  }
  // 'Z' or something unexpected — append 'A' (Z → ZA, etc.)
  return trimmed + 'A';
}

/**
 * Clone the latest revision of a quote into a new letter (A→B, B→C, …) and
 * drop the user into its step-1 so edits land on the new revision. The
 * original revision stays intact as a historical snapshot.
 */
export async function cloneQuoteForEdit(formData: FormData) {
  const user = await getUser();
  const quoteId = String(formData.get('quoteId') ?? '');

  const quote = await loadQuoteForTenant(quoteId, user.tenantId);
  const latest = quote.revisions[0];
  if (!latest) throw new Error('quote has no revisions');

  const newLabel = nextRevisionLabel(latest.label);

  const newRev = await db.revision.create({
    data: {
      quoteId: quote.id,
      label: newLabel,
      service:     latest.service     ?? undefined,
      site:        latest.site        ?? undefined,
      certs:       latest.certs       ?? undefined,
      geometry:    latest.geometry    ?? undefined,
      wallBuildup: latest.wallBuildup ?? undefined,
      outputs:     latest.outputs     ?? undefined,
    },
  });

  await writeAuditEntry(db, {
    entityType: 'Revision',
    entityId: newRev.id,
    revisionId: newRev.id,
    actorUserId: user.id,
    action: 'clone:for-edit',
    diffJson: { from: latest.label, to: newLabel },
  });

  redirect(`/quotes/${quote.id}/rev/${newRev.label}/step-1`);
}

/**
 * Hard-delete a quote + every revision underneath, tenant-scoped.
 */
export async function deleteQuote(formData: FormData) {
  const user = await getUser();
  const quoteId = String(formData.get('quoteId') ?? '');

  const quote = await loadQuoteForTenant(quoteId, user.tenantId);

  await db.$transaction(async (tx) => {
    await tx.revision.deleteMany({ where: { quoteId: quote.id } });
    await tx.quote.delete({ where: { id: quote.id } });
  });

  await writeAuditEntry(db, {
    entityType: 'Quote',
    entityId: quoteId,
    actorUserId: user.id,
    action: 'delete',
    diffJson: { number: quote.number },
  });

  revalidatePath('/quotes');
  revalidatePath('/dashboard');
}

/**
 * Change a quote's status. Stamps `wonAt` when transitioning into WON
 * (so the revenue chart picks it up) and clears it when moving away.
 */
export async function setQuoteStatus(formData: FormData) {
  const user = await getUser();
  const quoteId = String(formData.get('quoteId') ?? '');
  const status  = String(formData.get('status')  ?? '') as QuoteStatus;

  const VALID: QuoteStatus[] = ['DRAFT', 'SENT', 'ENGINEERING', 'BUILDING', 'WON', 'SHIPPED', 'LOST'];
  if (!VALID.includes(status)) throw new Error('invalid status');

  const quote = await loadQuoteForTenant(quoteId, user.tenantId);

  // SHIPPED is the post-WON terminal state — the deal is still won for
  // revenue purposes, so we treat both as "counts as won" when stamping
  // wonAt. Transitioning to anything else clears it.
  const wasCountedWon = quote.status === 'WON' || quote.status === 'SHIPPED';
  const isCountedWon  = status === 'WON' || status === 'SHIPPED';

  await db.quote.update({
    where: { id: quote.id },
    data: {
      status,
      wonAt: isCountedWon ? (wasCountedWon ? quote.wonAt : new Date()) : null,
    },
  });

  await writeAuditEntry(db, {
    entityType: 'Quote',
    entityId: quoteId,
    actorUserId: user.id,
    action: 'status:update',
    diffJson: { from: quote.status, to: status },
  });

  revalidatePath('/quotes');
  revalidatePath('/dashboard');
}
