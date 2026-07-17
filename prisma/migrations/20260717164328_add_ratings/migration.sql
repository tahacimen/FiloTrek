-- NOTE: Prisma's diff spuriously proposes dropping dock_reservations.during
-- on every migration because it's a raw-SQL generated column (backing a
-- GiST exclusion constraint) invisible to schema.prisma. That statement has
-- been removed here — the column is untouched by this migration.

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "customer_company_id" UUID NOT NULL,
    "supplier_company_id" UUID NOT NULL,
    "driver_id" UUID,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ratings_shipment_id_key" ON "ratings"("shipment_id");

-- CreateIndex
CREATE INDEX "ratings_supplier_company_id_idx" ON "ratings"("supplier_company_id");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_customer_company_id_fkey" FOREIGN KEY ("customer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_supplier_company_id_fkey" FOREIGN KEY ("supplier_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
