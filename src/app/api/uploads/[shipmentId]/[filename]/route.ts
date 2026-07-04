import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readUploadedPhoto } from "@/lib/file-storage";

/**
 * proxy.ts's matcher explicitly excludes /api/**, so this route gets ZERO
 * protection from the app's session-redirect middleware — it must
 * self-authenticate on every request. Doesn't use requireTenantContext()/
 * requireDriverContext() (they throw, but a route handler needs to return
 * an HTTP Response) — auth() is called directly and every failure mode
 * (not logged in, wrong company, shipment doesn't exist, file missing)
 * collapses to the same 404, mirroring the NotFoundError philosophy used
 * everywhere else in this app: no signal to a prober about *why* it failed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shipmentId: string; filename: string }> }
) {
  const { shipmentId, filename } = await params;
  const session = await auth();
  if (!session?.user) {
    return new Response(null, { status: 404 });
  }

  const hasAccess =
    session.user.accountType === "DRIVER"
      ? await prisma.shipment.findFirst({
          where: { id: shipmentId, driverId: session.user.driverId },
          select: { id: true },
        })
      : await prisma.shipment.findFirst({
          where: {
            id: shipmentId,
            OR: [
              { customerCompanyId: session.user.companyId },
              { supplierCompanyId: session.user.companyId },
            ],
          },
          select: { id: true },
        });
  if (!hasAccess) {
    return new Response(null, { status: 404 });
  }

  const photo = await readUploadedPhoto(shipmentId, filename);
  if (!photo) {
    return new Response(null, { status: 404 });
  }

  // TS's DOM lib doesn't structurally accept Node's Buffer type as BodyInit
  // even though it's a Uint8Array at runtime — a plain Uint8Array view
  // satisfies the type (and is cheap: photos are capped at 8MB).
  return new Response(new Uint8Array(photo.buffer), {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      // private: this is authenticated business evidence, never cached by
      // a shared/proxy cache — only the requesting browser's own cache.
      "Cache-Control": "private, max-age=300",
    },
  });
}
