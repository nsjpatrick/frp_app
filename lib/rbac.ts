import type { Role } from '@prisma/client';

const RANK: Record<Role, number> = { SALES: 1, ENGINEER: 2, ADMIN: 3 };

export function requireRole(actual: Role, required: Role): void {
  if (RANK[actual] < RANK[required]) {
    throw new Error(`insufficient role: needed ${required}, got ${actual}`);
  }
}

export function canSendFlaggedQuote(role: Role): boolean {
  return RANK[role] >= RANK.ENGINEER;
}
