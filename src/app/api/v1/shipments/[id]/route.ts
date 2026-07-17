import { requireApiKeyContext } from "@/core/company/api-key-context";
import * as shipmentRepository from "@/core/shipment/shipment-repository";
import { UnauthorizedError } from "@/core/shared/errors";
import { serializeShipmentForApi } from "@/app/api/v1/shipments/serialize";

/** GET /api/v1/shipments/[id] — single shipment, same auth/visibility rules as the list endpoint. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKeyCtx = await requireApiKeyContext(request);
    const { id } = await params;
    const shipment = await shipmentRepository.getShipmentForCompanyId(
      apiKeyCtx.companyId,
      id
    );
    if (!shipment) {
      return Response.json({ error: "Sefer bulunamadı." }, { status: 404 });
    }
    return Response.json(serializeShipmentForApi(shipment));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
