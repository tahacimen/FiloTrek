-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PRICE_REJECTED';

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "price_proposed_by" "CompanyType",
ADD COLUMN "price_rejected_at" TIMESTAMP(3);
