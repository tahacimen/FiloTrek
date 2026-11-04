-- D5: driver-picked dock reservations awaiting customer approval.

-- New reservation status for a driver-requested, not-yet-approved slot.
-- Added BEFORE 'CREATED' to read as the natural first lifecycle state.
-- (ADD VALUE runs outside the surrounding statements' effect but is committed
-- by migrate deploy before any later migration or app query uses it.)
ALTER TYPE "DockReservationStatus" ADD VALUE IF NOT EXISTS 'REQUESTED' BEFORE 'CREATED';

-- Flag: the customer has opened the dock calendar to this shipment's driver.
ALTER TABLE "shipments"
  ADD COLUMN "driver_dock_selection_enabled" boolean NOT NULL DEFAULT false;
