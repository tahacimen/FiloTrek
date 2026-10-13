-- AlterTable: vehicle document validity tracking
ALTER TABLE "vehicles"
  ADD COLUMN "registration_number" TEXT,
  ADD COLUMN "insurance_policy_number" TEXT,
  ADD COLUMN "inspection_expiry" TIMESTAMP(3),
  ADD COLUMN "insurance_expiry" TIMESTAMP(3);
