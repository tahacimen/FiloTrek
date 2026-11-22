-- Multimodal: transport mode + mode-specific reference fields on shipments.

CREATE TYPE "TransportMode" AS ENUM ('ROAD', 'SEA', 'AIR');
CREATE TYPE "LoadType" AS ENUM ('FTL', 'LTL', 'FCL', 'LCL');

ALTER TABLE "shipments"
  ADD COLUMN "transport_mode" "TransportMode" NOT NULL DEFAULT 'ROAD',
  ADD COLUMN "carrier_name" text,
  ADD COLUMN "booking_number" text,
  ADD COLUMN "container_number" text,
  ADD COLUMN "vessel_name" text,
  ADD COLUMN "airwaybill_number" text,
  ADD COLUMN "flight_number" text,
  ADD COLUMN "load_type" "LoadType";
