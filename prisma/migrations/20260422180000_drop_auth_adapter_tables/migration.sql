-- Demo mode — no real authentication. Drop the NextAuth / Auth.js adapter
-- tables (Session, Account, VerificationToken). They're unused: lib/auth.ts
-- resolves every request to the seeded demo admin directly via User.
--
-- Safe to re-run: uses IF EXISTS on every drop.

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "Account";
DROP TABLE IF EXISTS "VerificationToken";
