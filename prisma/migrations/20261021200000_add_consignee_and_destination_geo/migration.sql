-- CreateTable: customer "cari" / consignee (C1)
CREATE TABLE "customer_consignees" (
  "id" UUID NOT NULL,
  "customer_company_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "tax_number" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_consignees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_consignees_customer_company_id_idx" ON "customer_consignees"("customer_company_id");

ALTER TABLE "customer_consignees"
  ADD CONSTRAINT "customer_consignees_customer_company_id_fkey"
  FOREIGN KEY ("customer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: destination province/district carried from the chosen cari (C1)
ALTER TABLE "shipments"
  ADD COLUMN "destination_province" TEXT,
  ADD COLUMN "destination_district" TEXT;
