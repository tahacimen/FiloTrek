import type * as shipmentRepository from "@/core/shipment/shipment-repository";

// Matches shipmentListInclude in shipment-repository.ts exactly, via the
// actual return type of the functions that use it — rather than hand
// re-declaring the include shape here, which would drift silently if that
// include ever changes.
type ApiShipment = NonNullable<
  Awaited<ReturnType<typeof shipmentRepository.getShipmentForCompanyId>>
>;

/** The public, read-only shape of a shipment for /api/v1 — never the raw Prisma row (Decimal fields aren't JSON-safe, and internal-only fields like negotiation history stay out). */
export function serializeShipmentForApi(shipment: ApiShipment) {
  return {
    id: shipment.id,
    tracking_number: shipment.trackingNumber,
    status: shipment.status,
    origin_address: shipment.originAddress,
    destination_address: shipment.destinationAddress,
    distance_km: shipment.distanceKm.toNumber(),
    tonnage: shipment.tonnage.toNumber(),
    cargo_description: shipment.cargoDescription,
    customer_company: shipment.customerCompany,
    supplier_company: shipment.supplierCompany,
    // Explicit field lists, not the whole nested rows — the internal
    // include also carries a driver's licenseNumber and other fields that
    // shouldn't leak through a partner-facing read API.
    vehicle: shipment.vehicle
      ? {
          plate: shipment.vehicle.plate,
          vehicle_type: shipment.vehicle.vehicleType,
          bed_type: shipment.vehicle.bedType,
        }
      : null,
    driver: shipment.driver
      ? { full_name: shipment.driver.fullName, phone: shipment.driver.phone }
      : null,
    agreed_price: shipment.agreedPrice?.toNumber() ?? null,
    is_dangerous_goods: shipment.isDangerousGoods,
    adr_class: shipment.adrClass,
    requires_cold_chain: shipment.requiresColdChain,
    temperature_min_c: shipment.temperatureMinC?.toNumber() ?? null,
    temperature_max_c: shipment.temperatureMaxC?.toNumber() ?? null,
    created_at: shipment.createdAt.toISOString(),
    updated_at: shipment.updatedAt.toISOString(),
    completed_at: shipment.completedAt?.toISOString() ?? null,
  };
}
