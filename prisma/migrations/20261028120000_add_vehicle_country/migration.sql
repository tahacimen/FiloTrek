-- AlterTable: vehicle registration country (A1), default TR for existing rows
ALTER TABLE "vehicles"
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'TR';
