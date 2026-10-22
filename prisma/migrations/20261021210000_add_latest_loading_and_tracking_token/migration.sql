-- AlterTable: N4 latest loading time + N5 live-tracking share token
ALTER TABLE "shipments"
  ADD COLUMN "latest_loading_at" TIMESTAMP(3),
  ADD COLUMN "tracking_token" TEXT;

CREATE UNIQUE INDEX "shipments_tracking_token_key" ON "shipments"("tracking_token");
