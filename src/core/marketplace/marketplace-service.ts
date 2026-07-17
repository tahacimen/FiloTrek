import { prisma } from "@/lib/db";
import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as marketplaceRepository from "@/core/marketplace/marketplace-repository";
import * as companyRepository from "@/core/company/company-repository";
import * as notificationService from "@/core/notification/notification-service";
import { bidInputSchema } from "@/lib/validation/marketplace";
import { CompanyType, ShipmentBidStatus } from "@/generated/prisma/client";

export async function listOpenShipmentsForBidding(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  return marketplaceRepository.listOpenShipmentsForBidding(ctx.companyId);
}

/**
 * A supplier bidding on a shipment the customer left unassigned (see
 * createShipmentRequest's "Pazara Aç" mode). Resubmitting updates the same
 * bid row rather than creating a duplicate (unique on
 * [shipmentId, supplierCompanyId]).
 */
export async function submitBid(
  ctx: TenantContext,
  shipmentId: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = bidInputSchema.parse(rawInput);

  const shipment = await marketplaceRepository.getOpenShipmentById(shipmentId);
  if (!shipment) {
    throw new NotFoundError("Sefer bulunamadı veya artık pazarda değil.");
  }

  const bid = await marketplaceRepository.upsertBid(shipmentId, ctx.companyId, input);

  try {
    const supplierCompany = await companyRepository.getCompanyById(ctx.companyId);
    await notificationService.notifyNewBid({
      customerCompanyId: shipment.customerCompanyId,
      bidderCompanyName: supplierCompany?.name ?? "Bir tedarikçi",
      amount: input.price,
      shipment,
    });
  } catch (error) {
    console.error("Yeni teklif bildirimi oluşturulamadı:", error);
  }

  return bid;
}

/** Owner-scoped — only the customer who owns the shipment can see its bids. */
export async function listBidsForShipment(ctx: TenantContext, shipmentId: string) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, customerCompanyId: ctx.companyId },
    select: { id: true },
  });
  if (!shipment) throw new NotFoundError("Sefer bulunamadı.");

  return marketplaceRepository.listBidsForShipment(shipmentId);
}

/**
 * Accepting a bid IS the price approval — the customer explicitly chose
 * this exact price out of a list of competing offers, a more deliberate
 * act than the free-form negotiate/approve dance, so priceApprovedAt is
 * set immediately rather than leaving the supplier stuck waiting on a
 * redundant second approval (see the priceApprovedAt gate on
 * HEADING_TO_PICKUP in shipment-status.ts). Everything downstream —
 * assignVehicleAndDriver, price negotiation, status advances — proceeds
 * completely unchanged from here; bidding only ever decided *who*.
 */
export async function acceptBid(
  ctx: TenantContext,
  shipmentId: string,
  bidId: string
) {
  requireCompanyType(ctx, CompanyType.CUSTOMER);

  const { updatedShipment, acceptedBid, rejectedBids } = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, customerCompanyId: ctx.companyId, supplierCompanyId: null },
    });
    if (!shipment) {
      throw new NotFoundError("Sefer bulunamadı veya artık pazarda değil.");
    }

    const bid = await tx.shipmentBid.findFirst({
      where: { id: bidId, shipmentId, status: ShipmentBidStatus.PENDING },
    });
    if (!bid) {
      throw new ValidationError("Teklif bulunamadı veya artık geçerli değil.");
    }

    const updatedShipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        supplierCompanyId: bid.supplierCompanyId,
        agreedPrice: bid.price,
        priceProposedBy: CompanyType.SUPPLIER,
        priceApprovedAt: new Date(),
      },
    });

    // Fetched before the updateMany below flips their status, so we still
    // know who to notify afterwards.
    const otherPendingBids = await tx.shipmentBid.findMany({
      where: { shipmentId, id: { not: bid.id }, status: ShipmentBidStatus.PENDING },
      select: { supplierCompanyId: true },
    });

    await tx.shipmentBid.update({
      where: { id: bid.id },
      data: { status: ShipmentBidStatus.ACCEPTED },
    });
    await tx.shipmentBid.updateMany({
      where: { shipmentId, id: { not: bid.id }, status: ShipmentBidStatus.PENDING },
      data: { status: ShipmentBidStatus.REJECTED },
    });

    return { updatedShipment, acceptedBid: bid, rejectedBids: otherPendingBids };
  });

  try {
    const customerCompany = await companyRepository.getCompanyById(ctx.companyId);
    await notificationService.notifyBidAccepted({
      supplierCompanyId: acceptedBid.supplierCompanyId,
      customerCompanyName: customerCompany?.name ?? "Bir müşteri",
      shipment: updatedShipment,
    });
  } catch (error) {
    console.error("Teklif kabul bildirimi oluşturulamadı:", error);
  }

  try {
    await Promise.all(
      rejectedBids.map((bid) =>
        notificationService.notifyBidRejected({
          supplierCompanyId: bid.supplierCompanyId,
          shipment: updatedShipment,
        })
      )
    );
  } catch (error) {
    console.error("Teklif red bildirimleri oluşturulamadı:", error);
  }

  return updatedShipment;
}
