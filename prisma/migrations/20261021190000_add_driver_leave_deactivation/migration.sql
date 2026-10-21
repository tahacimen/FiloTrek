-- CreateEnum: supplier's reason for permanently deactivating a driver (N7)
CREATE TYPE "DriverDeactivationReason" AS ENUM ('LEFT_JOB', 'DISCIPLINE', 'HEALTH', 'MISSING_DOCUMENTS', 'OTHER');

-- AlterTable: driver date-range leave (N2) + hard deactivation (N7)
ALTER TABLE "drivers"
  ADD COLUMN "leave_start_date" TIMESTAMP(3),
  ADD COLUMN "leave_end_date" TIMESTAMP(3),
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deactivation_reason" "DriverDeactivationReason",
  ADD COLUMN "deactivation_note" TEXT,
  ADD COLUMN "deactivated_at" TIMESTAMP(3);
