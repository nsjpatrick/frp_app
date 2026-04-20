import { describe, it, expect } from 'vitest';
import { requireRole, canSendFlaggedQuote } from '@/lib/rbac';

describe('requireRole', () => {
  it('allows equal or higher role', () => {
    expect(() => requireRole('SALES', 'SALES')).not.toThrow();
    expect(() => requireRole('ENGINEER', 'SALES')).not.toThrow();
    expect(() => requireRole('ADMIN', 'ENGINEER')).not.toThrow();
  });

  it('throws on lower role', () => {
    expect(() => requireRole('SALES', 'ADMIN')).toThrow(/insufficient role/i);
    expect(() => requireRole('ENGINEER', 'ADMIN')).toThrow();
  });
});

describe('canSendFlaggedQuote', () => {
  it('true for ENGINEER and ADMIN', () => {
    expect(canSendFlaggedQuote('ENGINEER')).toBe(true);
    expect(canSendFlaggedQuote('ADMIN')).toBe(true);
  });
  it('false for SALES', () => {
    expect(canSendFlaggedQuote('SALES')).toBe(false);
  });
});
