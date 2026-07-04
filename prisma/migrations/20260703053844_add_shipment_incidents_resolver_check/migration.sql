-- Mirrors status_history's changed_by_one_actor_check: an incident is
-- resolved by exactly one kind of actor, never both.
ALTER TABLE "shipment_incidents" ADD CONSTRAINT "shipment_incidents_resolved_by_one_actor_check"
  CHECK ("resolved_by_user_id" IS NULL OR "resolved_by_driver_id" IS NULL);