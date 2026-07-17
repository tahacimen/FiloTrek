-- NOTE: Prisma's migration diff also proposed `ALTER TABLE
-- "dock_reservations" DROP COLUMN "during"` here — that's a raw-SQL
-- generated column (see 20260716061532_add_dock_reservation_system) backing
-- the dock_reservations_no_overlap GiST exclusion constraint, invisible to
-- schema.prisma by design. Deliberately omitted — do not add back.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BID_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'BID_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'BID_REJECTED';
