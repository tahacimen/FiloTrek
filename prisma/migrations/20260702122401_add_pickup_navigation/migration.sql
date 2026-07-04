-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'HEADING_TO_PICKUP' AFTER 'ASSIGNED';

-- AlterEnum
ALTER TYPE "VehicleStatus" ADD VALUE 'HEADING_TO_PICKUP' AFTER 'ASSIGNED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LOAD_READY';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'VEHICLE_DEPARTED';

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "document_tracking_number" TEXT,
ADD COLUMN "pickup_gate_info" TEXT,
ADD COLUMN "pickup_maps_url" TEXT,
ADD COLUMN "load_ready_at" TIMESTAMP(3);
