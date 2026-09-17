-- CreateEnum
CREATE TYPE "DemoInstanceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "demo_expires_at" TIMESTAMP(3),
ADD COLUMN "demo_login_token" TEXT;

-- CreateTable
CREATE TABLE "demo_instances" (
    "id" UUID NOT NULL,
    "demo_request_id" UUID,
    "created_by_user_id" UUID,
    "supplier_company_id" UUID NOT NULL,
    "customer_company_id" UUID NOT NULL,
    "supplier_user_id" UUID NOT NULL,
    "customer_user_id" UUID NOT NULL,
    "supplier_email" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "supplier_token" TEXT NOT NULL,
    "customer_token" TEXT NOT NULL,
    "status" "DemoInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_demo_login_token_key" ON "users"("demo_login_token");

-- CreateIndex
CREATE UNIQUE INDEX "demo_instances_supplier_token_key" ON "demo_instances"("supplier_token");

-- CreateIndex
CREATE UNIQUE INDEX "demo_instances_customer_token_key" ON "demo_instances"("customer_token");

-- CreateIndex
CREATE INDEX "demo_instances_status_expires_at_idx" ON "demo_instances"("status", "expires_at");
