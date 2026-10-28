-- AlterTable: mark marketplace-sourced ("spot") shipments
ALTER TABLE "shipments"
  ADD COLUMN "from_marketplace" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any shipment that ever received a bid was opened to the market.
UPDATE "shipments" s
SET "from_marketplace" = true
WHERE EXISTS (SELECT 1 FROM "shipment_bids" b WHERE b."shipment_id" = s."id");

-- Backfill: still-open (unassigned, pending) requests are on the market now.
UPDATE "shipments"
SET "from_marketplace" = true
WHERE "supplier_company_id" IS NULL AND "status" = 'PENDING';
