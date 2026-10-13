-- CreateTable
CREATE TABLE "customer_driver_blocks" (
    "id" UUID NOT NULL,
    "customer_company_id" UUID NOT NULL,
    "full_name" TEXT,
    "tc_number" TEXT,
    "license_number" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_driver_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_driver_blocks_customer_company_id_idx" ON "customer_driver_blocks"("customer_company_id");

-- AddForeignKey
ALTER TABLE "customer_driver_blocks" ADD CONSTRAINT "customer_driver_blocks_customer_company_id_fkey" FOREIGN KEY ("customer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
