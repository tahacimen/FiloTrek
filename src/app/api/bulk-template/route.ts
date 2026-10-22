import { requireTenantContext } from "@/core/shared/tenant-context";
import { buildBulkTemplate } from "@/core/shipment/bulk-request-service";
import { CompanyType } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// C3: downloadable Excel template for bulk vehicle requests. Customer-only —
// the template is static, but the endpoint is still auth-gated so it isn't a
// public, crawlable file.
export async function GET() {
  const ctx = await requireTenantContext();
  if (ctx.companyType !== CompanyType.CUSTOMER) {
    return new Response("Forbidden", { status: 403 });
  }

  const buffer = await buildBulkTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="logigo-toplu-arac-cagir-sablonu.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
