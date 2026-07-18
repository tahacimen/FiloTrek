-- NOTE: Prisma's diff spuriously proposes dropping dock_reservations.during
-- on every migration because it's a raw-SQL generated column (backing a
-- GiST exclusion constraint) invisible to schema.prisma. That statement has
-- been removed here — the column is untouched by this migration.

-- CreateEnum
CREATE TYPE "SignupRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SIGNUP_REQUESTED';

-- CreateTable
CREATE TABLE "signup_requests" (
    "id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "InvitationRole" NOT NULL,
    "message" TEXT,
    "status" "SignupRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signup_requests_status_created_at_idx" ON "signup_requests"("status", "created_at");
