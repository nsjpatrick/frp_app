-- New Quote.status value for vessels that have left the shop.
-- Placed between WON and LOST so it sorts next to the other terminal states.

ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'SHIPPED' AFTER 'WON';
