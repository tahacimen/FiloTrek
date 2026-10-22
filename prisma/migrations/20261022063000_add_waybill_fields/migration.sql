-- AlterTable: G3 stamped/signed waybill (irsaliye) + supplier confirmation
ALTER TABLE "shipments"
  ADD COLUMN "waybill_photo_url" TEXT,
  ADD COLUMN "waybill_confirmed_at" TIMESTAMP(3),
  ADD COLUMN "waybill_confirmed_by_user_id" UUID;
