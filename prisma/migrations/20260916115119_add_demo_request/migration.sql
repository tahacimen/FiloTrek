/*
  Warnings:

  - You are about to drop the column `during` on the `dock_reservations` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DemoRequestStatus" AS ENUM ('NEW', 'CONTACTED');

-- AlterTable
ALTER TABLE "dock_reservations" DROP COLUMN "during";

-- CreateTable
CREATE TABLE "demo_requests" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "vehicle_count" INTEGER NOT NULL,
    "message" TEXT,
    "status" "DemoRequestStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_requests_status_created_at_idx" ON "demo_requests"("status", "created_at");
