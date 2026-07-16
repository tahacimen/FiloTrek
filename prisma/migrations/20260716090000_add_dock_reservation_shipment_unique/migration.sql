-- A shipment can be linked to at most one *active* dock reservation at a
-- time, since linking now drives a best-effort shipment status sync (see
-- dock-reservation-status.ts) — two live reservations racing to advance the
-- same shipment would be ambiguous. A cancelled reservation frees its
-- shipment link, same "WHERE status <> 'CANCELLED'" spirit as
-- dock_reservations_no_overlap in the add_dock_reservation_system migration.
-- Prisma's schema DSL can't express a partial unique index, hence raw SQL.
CREATE UNIQUE INDEX "dock_reservations_shipment_id_active_key"
  ON "dock_reservations"("shipment_id")
  WHERE "shipment_id" IS NOT NULL AND "status" <> 'CANCELLED';
