-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: at most one default warehouse (loading point) per company.
-- Partial unique index — not expressible in Prisma's schema DSL, so it lives
-- here as a raw-SQL invariant (same pattern as the dock_reservations
-- shipment-unique index). setDefaultWarehouse unsets the prior default in the
-- same transaction, so this never conflicts.
CREATE UNIQUE INDEX "warehouses_company_default_unique" ON "warehouses" ("company_id") WHERE "is_default";
