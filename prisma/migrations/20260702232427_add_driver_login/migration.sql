-- AlterEnum
ALTER TYPE "StatusChangeSource" ADD VALUE 'DRIVER';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_ARRIVED_PICKUP';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_DEPARTED_PICKUP';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_ARRIVED_DELIVERY';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_COMPLETED_DELIVERY';

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN "email" TEXT,
ADD COLUMN "password_hash" TEXT,
ADD COLUMN "tc_number" TEXT,
ADD COLUMN "experience_years" INTEGER,
ADD COLUMN "last_login_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "drivers_email_key" ON "drivers"("email");

-- AlterTable
ALTER TABLE "status_history" ADD COLUMN "changed_by_driver_id" UUID;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changed_by_driver_id_fkey" FOREIGN KEY ("changed_by_driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Exactly one of changed_by_user_id / changed_by_driver_id may be set at a time.
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changed_by_one_actor_check"
  CHECK ("changed_by_user_id" IS NULL OR "changed_by_driver_id" IS NULL);
