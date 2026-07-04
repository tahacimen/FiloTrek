-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'VEHICLE_ENTERED_GATE';
ALTER TYPE "NotificationType" ADD VALUE 'VEHICLE_EXITED_GATE';

-- CreateEnum
CREATE TYPE "GateEventType" AS ENUM ('VEHICLE_ENTERED', 'VEHICLE_EXITED');

-- CreateTable
CREATE TABLE "gate_guards" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gate_guards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_events" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "gate_guard_id" UUID NOT NULL,
    "event_type" "GateEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gate_guards_email_key" ON "gate_guards"("email");

-- CreateIndex
CREATE INDEX "gate_guards_company_id_idx" ON "gate_guards"("company_id");

-- CreateIndex
CREATE INDEX "gate_events_shipment_id_occurred_at_idx" ON "gate_events"("shipment_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "gate_guards" ADD CONSTRAINT "gate_guards_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_events" ADD CONSTRAINT "gate_events_gate_guard_id_fkey" FOREIGN KEY ("gate_guard_id") REFERENCES "gate_guards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
