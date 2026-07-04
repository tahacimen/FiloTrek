-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'INCIDENT_REPORTED';
ALTER TYPE "NotificationType" ADD VALUE 'INCIDENT_RESOLVED';

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "has_open_incident" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "status_history" ADD COLUMN     "photo_url" TEXT;

-- CreateTable
CREATE TABLE "shipment_incidents" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "reported_by_driver_id" UUID,
    "note" TEXT,
    "photo_url" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_driver_id" UUID,
    "resolved_by_user_id" UUID,
    "resolution_note" TEXT,

    CONSTRAINT "shipment_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_incidents_shipment_id_resolved_at_idx" ON "shipment_incidents"("shipment_id", "resolved_at");

-- AddForeignKey
ALTER TABLE "shipment_incidents" ADD CONSTRAINT "shipment_incidents_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_incidents" ADD CONSTRAINT "shipment_incidents_reported_by_driver_id_fkey" FOREIGN KEY ("reported_by_driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_incidents" ADD CONSTRAINT "shipment_incidents_resolved_by_driver_id_fkey" FOREIGN KEY ("resolved_by_driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_incidents" ADD CONSTRAINT "shipment_incidents_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
