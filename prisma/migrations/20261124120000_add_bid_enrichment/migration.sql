-- Spot bidding enrichment: deadline, invite-only, bid transit/validity, and
-- the targeted-invitation table.

ALTER TABLE "shipments"
  ADD COLUMN "bidding_deadline" timestamp(3),
  ADD COLUMN "bidding_invite_only" boolean NOT NULL DEFAULT false;

ALTER TABLE "shipment_bids"
  ADD COLUMN "transit_days" integer,
  ADD COLUMN "valid_until" timestamp(3);

CREATE TABLE "shipment_bid_invitations" (
  "id" uuid NOT NULL,
  "shipment_id" uuid NOT NULL,
  "supplier_company_id" uuid NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipment_bid_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipment_bid_invitations_shipment_id_supplier_company_id_key"
  ON "shipment_bid_invitations" ("shipment_id", "supplier_company_id");
CREATE INDEX "shipment_bid_invitations_supplier_company_id_idx"
  ON "shipment_bid_invitations" ("supplier_company_id");

ALTER TABLE "shipment_bid_invitations"
  ADD CONSTRAINT "shipment_bid_invitations_shipment_id_fkey"
  FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_bid_invitations"
  ADD CONSTRAINT "shipment_bid_invitations_supplier_company_id_fkey"
  FOREIGN KEY ("supplier_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
