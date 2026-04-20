import type { PrismaClient } from '@prisma/client';

export type AuditEntryInput = {
  entityType: string;
  entityId: string;
  revisionId?: string;
  actorUserId: string;
  action: string;
  diffJson: Record<string, unknown>;
};

export async function writeAuditEntry(db: PrismaClient, input: AuditEntryInput) {
  return db.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      revisionId: input.revisionId,
      actorUserId: input.actorUserId,
      action: input.action,
      diffJson: input.diffJson as any,
    },
  });
}
