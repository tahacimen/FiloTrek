import { requireApiKeyContext } from "@/core/company/api-key-context";
import * as shipmentRepository from "@/core/shipment/shipment-repository";
import { UnauthorizedError } from "@/core/shared/errors";
import { serializeShipmentForApi } from "@/app/api/v1/shipments/serialize";

/**
 * GET /api/v1/shipments — read-only listing of every shipment visible to
 * the calling company (as customer or supplier), Bearer-authenticated
 * against Company.apiKey. proxy.ts excludes /api/** from its
 * session-redirect middleware, so this self-authenticates on every call
 * (same rationale as /api/uploads).
 */
export async function GET(request: Request) {
  try {
    const apiKeyCtx = await requireApiKeyContext(request);
    const shipments = await shipmentRepository.listShipmentsForCompanyId(
      apiKeyCtx.companyId
    );
    return Response.json({
      shipments: shipments.map(serializeShipmentForApi),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
