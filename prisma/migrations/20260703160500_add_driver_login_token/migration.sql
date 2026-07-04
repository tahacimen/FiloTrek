-- AlterTable
ALTER TABLE "drivers" ADD COLUMN "login_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "drivers_login_token_key" ON "drivers"("login_token");
