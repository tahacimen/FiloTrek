-- Human-friendly 8-digit shipment tracking numbers, starting at 10000000.
-- A dedicated sequence provides the default; adding the column with that
-- default backfills every existing row (10000000, 10000001, ...) in one
-- pass, and new rows keep drawing from it. Prisma models this as
-- @default(autoincrement()), so create() never supplies the value.
CREATE SEQUENCE "shipments_tracking_number_seq" START WITH 10000000 MINVALUE 10000000;

ALTER TABLE "shipments"
  ADD COLUMN "tracking_number" INTEGER NOT NULL DEFAULT nextval('"shipments_tracking_number_seq"');

ALTER SEQUENCE "shipments_tracking_number_seq" OWNED BY "shipments"."tracking_number";

CREATE UNIQUE INDEX "shipments_tracking_number_key" ON "shipments"("tracking_number");
