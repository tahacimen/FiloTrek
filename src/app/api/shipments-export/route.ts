import { requireTenantContext } from "@/core/shared/tenant-context";
import { listShipments } from "@/core/shipment/shipment-service";
import {
  buildShipmentsExport,
  type ExportableShipment,
} from "@/core/shipment/shipment-export-service";
import {
  shipmentFiltersFromParams,
  shipmentMatchesFilters,
} from "@/lib/shipment-filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// S1: Excel export of the Seferler list, filtered server-side with the exact
// same predicate the on-screen filter bar uses, so the file matches the view.
export async function GET(request: Request) {
  const ctx = await requireTenantContext();
  const filters = shipmentFiltersFromParams(
    new URL(request.url).searchParams
  );

  const shipments = await listShipments(ctx);
  const filtered = shipments.filter((s) =>
    shipmentMatchesFilters(s, filters)
  ) as unknown as ExportableShipment[];

  const buffer = await buildShipmentsExport(filtered);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="logigo-seferler-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
