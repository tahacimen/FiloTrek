import { requireTenantContext } from "@/core/shared/tenant-context";
import { listMyBids } from "@/core/marketplace/marketplace-service";
import {
  buildMyBidsExport,
  type ExportableBid,
} from "@/core/marketplace/bid-export-service";
import {
  bidMatchesFilters,
  myBidFiltersFromParams,
} from "@/lib/bid-filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// P2: Excel export of the supplier's own bids ("Tekliflerim"), filtered
// server-side with the same predicate the on-screen filter bar uses.
export async function GET(request: Request) {
  const ctx = await requireTenantContext();
  const filters = myBidFiltersFromParams(new URL(request.url).searchParams);

  const bids = await listMyBids(ctx);
  const filtered = bids.filter((b) =>
    bidMatchesFilters(b, filters)
  ) as unknown as ExportableBid[];

  const buffer = await buildMyBidsExport(filtered);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="logigo-tekliflerim-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
