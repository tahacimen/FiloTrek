import { prisma } from "@/lib/db";
import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError } from "@/core/shared/errors";
import { shipmentPaymentInputSchema } from "@/lib/validation/payment";
import { CompanyType, PaymentStatus } from "@/generated/prisma/client";

/**
 * The SUPPLIER that runs a shipment records whether its payment has been
 * received and, optionally, a due date. Scoped to the supplier's own
 * shipments. The customer only ever reads these fields (on their own
 * shipments) — see the payment card on the shipment detail page.
 */
export async function setShipmentPayment(
  ctx: TenantContext,
  shipmentId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = shipmentPaymentInputSchema.parse(rawInput);

  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, supplierCompanyId: ctx.companyId },
    select: { id: true, paidAt: true },
  });
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");

  // Preserve the original paid moment if it was already marked paid; stamp a
  // fresh one on the transition to PAID; clear it when reverted to PENDING.
  const paidAt =
    input.status === PaymentStatus.PAID
      ? (shipment.paidAt ?? new Date())
      : null;

  return prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      paymentStatus: input.status,
      paymentDueDate: input.dueDate,
      paidAt,
    },
  });
}
