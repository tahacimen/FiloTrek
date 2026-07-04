-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PRICE_PROPOSED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PRICE_APPROVED';

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN "price_approved_at" TIMESTAMP(3);
