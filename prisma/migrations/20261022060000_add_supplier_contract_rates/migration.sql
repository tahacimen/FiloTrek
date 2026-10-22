-- CreateEnum: contract pricing method (G2)
CREATE TYPE "ContractPricingMethod" AS ENUM ('LANE_FIXED', 'PER_KM', 'PER_TON');

-- CreateTable: supplier's pre-agreed per-customer rates (G2)
CREATE TABLE "supplier_contract_rates" (
  "id" UUID NOT NULL,
  "supplier_company_id" UUID NOT NULL,
  "customer_company_id" UUID NOT NULL,
  "method" "ContractPricingMethod" NOT NULL,
  "destination_province" TEXT,
  "destination_district" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_contract_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_contract_rates_supplier_company_id_customer_company_idx"
  ON "supplier_contract_rates"("supplier_company_id", "customer_company_id");

ALTER TABLE "supplier_contract_rates"
  ADD CONSTRAINT "supplier_contract_rates_supplier_company_id_fkey"
  FOREIGN KEY ("supplier_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_contract_rates"
  ADD CONSTRAINT "supplier_contract_rates_customer_company_id_fkey"
  FOREIGN KEY ("customer_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
