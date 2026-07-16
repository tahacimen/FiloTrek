-- Real physical address/navigation link for a customer's warehouse — what a
-- supplier's driver actually needs, mirroring shipments.origin_address /
-- origin_maps_url. Nullable: existing warehouses (none in production yet)
-- and newly-created ones can fill this in after the fact.
ALTER TABLE "warehouses" ADD COLUMN "address" TEXT;
ALTER TABLE "warehouses" ADD COLUMN "maps_url" TEXT;

-- A gate guard advancing a shipment's status as a side effect of a linked
-- dock reservation event (see dock-reservation-status.ts) — distinct from
-- DRIVER (a different actor) and SYSTEM_AUTO (implies no human involved).
ALTER TYPE "StatusChangeSource" ADD VALUE 'GATE_GUARD';
