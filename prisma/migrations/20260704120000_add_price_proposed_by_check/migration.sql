-- A price can only be "on the table" if we know whose turn it is to wait
-- for a response — see the schema comment on Shipment.priceProposedBy and
-- the isProposer/isCounterparty split in price-approval-card.tsx, which
-- both assume this can never be true.
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_price_proposed_by_required_check"
  CHECK ("agreed_price" IS NULL OR "price_proposed_by" IS NOT NULL);
