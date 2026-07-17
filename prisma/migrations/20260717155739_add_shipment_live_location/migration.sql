-- NOTE: Prisma's migration diff also proposed `ALTER TABLE
-- "dock_reservations" DROP COLUMN "during"` here — that's a raw-SQL
-- generated column (see 20260716061532_add_dock_reservation_system) backing
-- the dock_reservations_no_overlap GiST exclusion constraint, invisible to
-- schema.prisma by design. Deliberately omitted — do not add back.

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "last_known_lat" DECIMAL(9,6),
ADD COLUMN     "last_known_lng" DECIMAL(9,6),
ADD COLUMN     "last_location_at" TIMESTAMP(3);
