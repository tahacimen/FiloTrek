-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "api_key" TEXT,
ADD COLUMN     "webhook_secret" TEXT,
ADD COLUMN     "webhook_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "companies_api_key_key" ON "companies"("api_key");
