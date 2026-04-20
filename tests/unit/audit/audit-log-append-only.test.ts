import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '../../../generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const db = createClient();

describe('AuditLog append-only', () => {
  let created: { id: string };

  beforeAll(async () => {
    created = await db.auditLog.create({
      data: {
        entityType: 'Test',
        entityId: 'test-1',
        actorUserId: 'user-1',
        action: 'create',
        diffJson: {},
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('blocks UPDATE', async () => {
    await expect(
      db.auditLog.update({
        where: { id: created.id },
        data: { action: 'update' },
      })
    ).rejects.toThrow(/append-only/);
  });

  it('blocks DELETE', async () => {
    await expect(
      db.auditLog.delete({ where: { id: created.id } })
    ).rejects.toThrow(/append-only/);
  });
});
