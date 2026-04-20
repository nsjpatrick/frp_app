import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { writeAuditEntry } from '@/lib/audit/audit-log';
import 'dotenv/config';

const db = new PrismaClient();

describe('writeAuditEntry', () => {
  afterAll(() => db.$disconnect());

  it('persists an entry', async () => {
    const entry = await writeAuditEntry(db, {
      entityType: 'Customer',
      entityId: 'test-cust',
      actorUserId: 'test-user',
      action: 'create',
      diffJson: { name: { from: null, to: 'Acme' } },
    });
    expect(entry.id).toBeTruthy();

    const row = await db.auditLog.findUnique({ where: { id: entry.id } });
    expect(row?.action).toBe('create');
  });
});
