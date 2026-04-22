-- Quotes become optionally project-less. Every existing quote is derived
-- via its project's customer, so we backfill customerId from that join
-- before tightening the constraint.

-- DropForeignKey
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_projectId_fkey";

-- 1. Make projectId nullable first
ALTER TABLE "Quote" ALTER COLUMN "projectId" DROP NOT NULL;

-- 2. Add customerId as nullable to let us backfill
ALTER TABLE "Quote" ADD COLUMN "customerId" TEXT;

-- 3. Backfill customerId from the existing project relationship
UPDATE "Quote" q
SET "customerId" = p."customerId"
FROM "Project" p
WHERE q."projectId" = p."id";

-- 4. Tighten customerId to NOT NULL now that every row has one
ALTER TABLE "Quote" ALTER COLUMN "customerId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
