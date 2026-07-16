-- CreateEnum
CREATE TYPE "InvitationRole" AS ENUM ('SUPPLIER_COMPANY', 'CUSTOMER_COMPANY');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- NOTE: Prisma's migration diff also proposed `ALTER TABLE "dock_reservations"
-- DROP COLUMN "during"` here — that column is a raw-SQL generated column
-- (see 20260716061532_add_dock_reservation_system/migration.sql) backing the
-- dock_reservations_no_overlap GiST exclusion constraint. It's invisible to
-- schema.prisma by design (Prisma can't model generated columns), so the
-- diff always misreads it as drift. Deliberately omitted — do not add back.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "InvitationRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
