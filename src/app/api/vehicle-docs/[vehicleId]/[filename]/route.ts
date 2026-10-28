import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readUploadedPhoto } from "@/lib/file-storage";

/**
 * A2: serves a vehicle's ruhsat (registration) photo, authenticated on every
 * request (proxy.ts excludes /api/**). Access is scoped to the company that
 * owns the vehicle; every failure mode collapses to a 404, same no-signal
 * philosophy as the shipment uploads route.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vehicleId: string; filename: string }> }
) {
  const { vehicleId, filename } = await params;
  const session = await auth();
  if (!session?.user || session.user.accountType !== "COMPANY_USER") {
    return new Response(null, { status: 404 });
  }

  const owns = await prisma.vehicle.findFirst({
    where: { id: vehicleId, companyId: session.user.companyId },
    select: { id: true },
  });
  if (!owns) {
    return new Response(null, { status: 404 });
  }

  const photo = await readUploadedPhoto(vehicleId, filename);
  if (!photo) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(photo.buffer), {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
