-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "shipments"
  ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "payment_due_date" TIMESTAMP(3),
  ADD COLUMN "paid_at" TIMESTAMP(3);
