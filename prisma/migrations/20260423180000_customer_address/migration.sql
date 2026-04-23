-- Add optional company address columns to Customer.
-- All nullable — existing rows keep working; reps fill these in over time
-- and the Quote PDF's "Prepared For" block reads them when present.
ALTER TABLE "Customer"
  ADD COLUMN "addressLine1" TEXT,
  ADD COLUMN "addressLine2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "country" TEXT;
