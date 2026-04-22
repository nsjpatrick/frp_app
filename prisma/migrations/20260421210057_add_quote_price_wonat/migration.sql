-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "totalPrice" DOUBLE PRECISION,
ADD COLUMN     "wonAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Quote_wonAt_idx" ON "Quote"("wonAt");
