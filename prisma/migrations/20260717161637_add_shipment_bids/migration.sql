-- NOTE: Prisma's migration diff also proposed `ALTER TABLE
-- "dock_reservations" DROP COLUMN "during"` here — that's a raw-SQL
-- generated column (see 20260716061532_add_dock_reservation_system) backing
-- the dock_reservations_no_overlap GiST exclusion constraint, invisible to
-- schema.prisma by design. Deliberately omitted — do not add back.

-- CreateEnum
CREATE TYPE "ShipmentBidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "shipment_bids" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "supplier_company_id" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "message" TEXT,
    "status" "ShipmentBidStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_bids_shipment_id_idx" ON "shipment_bids"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_bids_shipment_id_supplier_company_id_key" ON "shipment_bids"("shipment_id", "supplier_company_id");

-- AddForeignKey
ALTER TABLE "shipment_bids" ADD CONSTRAINT "shipment_bids_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_bids" ADD CONSTRAINT "shipment_bids_supplier_company_id_fkey" FOREIGN KEY ("supplier_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
