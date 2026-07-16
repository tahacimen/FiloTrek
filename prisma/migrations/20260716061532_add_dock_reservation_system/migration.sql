-- CreateEnum
CREATE TYPE "DockReservationType" AS ENUM ('LOADING', 'UNLOADING');

-- CreateEnum
CREATE TYPE "DockReservationStatus" AS ENUM ('CREATED', 'VEHICLE_ARRIVED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loading_docks" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "supported_reservation_types" "DockReservationType"[],
    "supported_vehicle_types" "VehicleType"[],
    "supported_bed_types" "VehicleBedType"[],
    "slot_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loading_docks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dock_working_hours" (
    "id" UUID NOT NULL,
    "dock_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,

    CONSTRAINT "dock_working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dock_reservations" (
    "id" UUID NOT NULL,
    "dock_id" UUID NOT NULL,
    "shipment_id" UUID,
    "reservation_type" "DockReservationType" NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "vehicle_type" "VehicleType",
    "cargo_type" TEXT,
    "quantity" INTEGER,
    "total_weight_kg" DECIMAL(10,2),
    "plate" TEXT NOT NULL,
    "driver_name" TEXT NOT NULL,
    "driver_phone" TEXT,
    "notes" TEXT,
    "status" "DockReservationStatus" NOT NULL DEFAULT 'CREATED',
    "arrived_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouses_company_id_idx" ON "warehouses"("company_id");

-- CreateIndex
CREATE INDEX "loading_docks_warehouse_id_idx" ON "loading_docks"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "dock_working_hours_dock_id_day_of_week_key" ON "dock_working_hours"("dock_id", "day_of_week");

-- CreateIndex
CREATE INDEX "dock_reservations_dock_id_start_at_idx" ON "dock_reservations"("dock_id", "start_at");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loading_docks" ADD CONSTRAINT "loading_docks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dock_working_hours" ADD CONSTRAINT "dock_working_hours_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "loading_docks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dock_reservations" ADD CONSTRAINT "dock_reservations_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "loading_docks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dock_reservations" ADD CONSTRAINT "dock_reservations_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prevent two reservations from overlapping on the same dock at the DB
-- level, the same way shipments_price_proposed_by_required_check enforces
-- invariants a check-then-write in application code can't race-proof.
-- A cancelled reservation frees its slot (WHERE clause), so re-booking the
-- same time after a cancellation is allowed.
-- Uses tsrange (not tstzrange): start_at/end_at are TIMESTAMP(3) WITHOUT TIME
-- ZONE like every other DateTime column in this schema, and a timestamp ->
-- timestamptz cast depends on the session's timezone setting, which
-- Postgres rejects inside a STORED generated column ("generation expression
-- is not immutable").
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "dock_reservations"
  ADD COLUMN "during" tsrange GENERATED ALWAYS AS (tsrange("start_at", "end_at", '[)')) STORED;

ALTER TABLE "dock_reservations" ADD CONSTRAINT "dock_reservations_no_overlap"
  EXCLUDE USING gist ("dock_id" WITH =, "during" WITH &&)
  WHERE ("status" <> 'CANCELLED');
