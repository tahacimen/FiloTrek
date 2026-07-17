-- NOTE: Prisma's diff spuriously proposes dropping dock_reservations.during
-- on every migration because it's a raw-SQL generated column (backing a
-- GiST exclusion constraint) invisible to schema.prisma. That statement has
-- been removed here — the column is untouched by this migration.

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "adr_class" TEXT,
ADD COLUMN     "is_dangerous_goods" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_cold_chain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "temperature_max_c" DECIMAL(5,2),
ADD COLUMN     "temperature_min_c" DECIMAL(5,2);
