import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { generateLoginToken } from "@/lib/tokens";
import { requirePlatformAdmin } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError } from "@/core/shared/errors";
import {
  CompanyRole,
  CompanyType,
  DemoInstanceStatus,
  DriverStatus,
  Prisma,
  ShipmentStatus,
  StatusChangeSource,
  StatusEntityType,
  VehicleBedType,
  VehicleStatus,
  VehicleType,
} from "@/generated/prisma/client";

/** How long a provisioned demo stays usable before it is auto-expired. */
export const DEMO_TTL_DAYS = 7;

/** Short, human-noticeable, collision-resistant suffix for demo names/plates/emails. */
function suffix(): string {
  return randomBytes(3).toString("hex"); // 6 hex chars
}

function hoursAgo(n: number) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

const ACTIVE_SEQUENCE: ShipmentStatus[] = [
  ShipmentStatus.PENDING,
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.HEADING_TO_PICKUP,
  ShipmentStatus.LOADING,
  ShipmentStatus.AT_PICKUP_GATE,
  ShipmentStatus.EN_ROUTE,
  ShipmentStatus.AT_DELIVERY_POINT,
  ShipmentStatus.COMPLETED,
];

type Tx = Prisma.TransactionClient;

/**
 * Provisions a fully isolated sandbox demo world for a prospect and records it
 * as a DemoInstance. Creates one demo SUPPLIER company + one demo CUSTOMER
 * company (both isDemo=true, so cross-realm discovery never mixes them with
 * real tenants — see company-repository / marketplace-repository), each with a
 * magic-link demo user that expires after DEMO_TTL_DAYS, plus a compact but
 * lifelike dataset (vehicles, drivers, and shipments across the status
 * lifecycle). Returns the instance; the owner forwards the two login links.
 */
export async function provisionDemoInstance(
  ctx: TenantContext,
  opts: { demoRequestId?: string | null; companyLabel?: string } = {}
) {
  requirePlatformAdmin(ctx);

  const sfx = suffix();
  const expiresAt = new Date(
    Date.now() + DEMO_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  // Demo users authenticate via the magic-link (demo-token provider), never a
  // password — but the column is non-null, so store a random unusable hash.
  const passwordHash = await hash(generateLoginToken(), 10);
  const supplierToken = generateLoginToken();
  const customerToken = generateLoginToken();
  const supplierEmail = `demo-tedarikci-${sfx}@demo.logigo.local`;
  const customerEmail = `demo-musteri-${sfx}@demo.logigo.local`;
  const label = opts.companyLabel?.trim();

  const instance = await prisma.$transaction(async (tx) => {
    const supplierCompany = await tx.company.create({
      data: {
        name: `Demo Nakliyat (${sfx})`,
        type: CompanyType.SUPPLIER,
        address: "Hadımköy, İstanbul",
        phone: "0212 000 00 00",
        isDemo: true,
      },
    });
    const customerCompany = await tx.company.create({
      data: {
        name: label ? `${label} (Demo)` : `Demo Lojistik (${sfx})`,
        type: CompanyType.CUSTOMER,
        address: "Bornova, İzmir",
        phone: "0232 000 00 00",
        isDemo: true,
      },
    });

    const supplierUser = await tx.user.create({
      data: {
        companyId: supplierCompany.id,
        email: supplierEmail,
        passwordHash,
        fullName: "Demo Tedarikçi",
        companyRole: CompanyRole.ADMIN,
        isDemo: true,
        demoExpiresAt: expiresAt,
        demoLoginToken: supplierToken,
      },
    });
    const customerUser = await tx.user.create({
      data: {
        companyId: customerCompany.id,
        email: customerEmail,
        passwordHash,
        fullName: "Demo Müşteri",
        companyRole: CompanyRole.ADMIN,
        isDemo: true,
        demoExpiresAt: expiresAt,
        demoLoginToken: customerToken,
      },
    });

    await seedDemoWorld(tx, {
      sfx,
      supplierCompanyId: supplierCompany.id,
      customerCompanyId: customerCompany.id,
      dispatcherUserId: supplierUser.id,
    });

    return tx.demoInstance.create({
      data: {
        demoRequestId: opts.demoRequestId ?? null,
        createdByUserId: ctx.userId,
        supplierCompanyId: supplierCompany.id,
        customerCompanyId: customerCompany.id,
        supplierUserId: supplierUser.id,
        customerUserId: customerUser.id,
        supplierEmail,
        customerEmail,
        supplierToken,
        customerToken,
        expiresAt,
      },
    });
  });

  return instance;
}

/** Compact, lifelike sample data scoped entirely to the demo companies. */
async function seedDemoWorld(
  tx: Tx,
  args: {
    sfx: string;
    supplierCompanyId: string;
    customerCompanyId: string;
    dispatcherUserId: string;
  }
) {
  const { sfx, supplierCompanyId, customerCompanyId, dispatcherUserId } = args;
  const P = sfx.toUpperCase().slice(0, 4);

  const [v1, v2, v3, v4] = await Promise.all(
    [
      { plate: `34 DM ${P}1`, vehicleType: VehicleType.TIR, bedType: VehicleBedType.TENTELI, tonnageCapacity: 25, status: VehicleStatus.AVAILABLE },
      { plate: `34 DM ${P}2`, vehicleType: VehicleType.TIR, bedType: VehicleBedType.FRIGORIFIK, tonnageCapacity: 22, status: VehicleStatus.AVAILABLE },
      { plate: `34 DM ${P}3`, vehicleType: VehicleType.KAMYON, bedType: VehicleBedType.KAPALI_KASA, tonnageCapacity: 10, status: VehicleStatus.EN_ROUTE },
      { plate: `34 DM ${P}4`, vehicleType: VehicleType.KAMYON, bedType: VehicleBedType.ACIK_KASA, tonnageCapacity: 12, status: VehicleStatus.HEADING_TO_PICKUP },
    ].map((data) => tx.vehicle.create({ data: { ...data, companyId: supplierCompanyId } }))
  );

  const [d1, d2, d3] = await Promise.all(
    [
      { fullName: "Ahmet Yılmaz", phone: "0533 900 00 01", licenseNumber: `DM${P}01`, status: DriverStatus.AVAILABLE },
      { fullName: "Mehmet Demir", phone: "0533 900 00 02", licenseNumber: `DM${P}02`, status: DriverStatus.ON_TRIP },
      { fullName: "Kemal Şahin", phone: "0533 900 00 03", licenseNumber: `DM${P}03`, status: DriverStatus.ON_TRIP },
    ].map((data) => tx.driver.create({ data: { ...data, companyId: supplierCompanyId } }))
  );

  async function shipment(opts: {
    vehicleId: string | null;
    driverId: string | null;
    origin: string;
    destination: string;
    distanceKm: number;
    tonnage: number;
    price: number | null;
    finalStatus: ShipmentStatus;
    createdAt: Date;
    priceApproved?: boolean;
    supplierNull?: boolean;
  }) {
    const targetIndex = ACTIVE_SEQUENCE.indexOf(opts.finalStatus);
    const created = await tx.shipment.create({
      data: {
        customerCompanyId,
        supplierCompanyId: opts.supplierNull ? null : supplierCompanyId,
        vehicleId: opts.vehicleId,
        driverId: opts.driverId,
        originAddress: opts.origin,
        destinationAddress: opts.destination,
        distanceKm: opts.distanceKm,
        tonnage: opts.tonnage,
        agreedPrice: opts.price ?? null,
        priceProposedBy: opts.price != null ? CompanyType.SUPPLIER : null,
        priceApprovedAt: opts.priceApproved ? opts.createdAt : null,
        status: opts.finalStatus,
        createdAt: opts.createdAt,
        completedAt:
          opts.finalStatus === ShipmentStatus.COMPLETED ? opts.createdAt : null,
      },
    });
    if (targetIndex > 0) {
      await tx.statusHistory.createMany({
        data: ACTIVE_SEQUENCE.slice(0, targetIndex + 1).map((status, i) => ({
          entityType: StatusEntityType.SHIPMENT,
          entityId: created.id,
          fromStatus: i === 0 ? null : ACTIVE_SEQUENCE[i - 1],
          toStatus: status,
          changedByUserId: dispatcherUserId,
          source: StatusChangeSource.MANUAL,
          createdAt: new Date(opts.createdAt.getTime() + i * 20 * 60 * 1000),
        })),
      });
    }
    return created;
  }

  // Active — drives the live map + timeline card.
  await shipment({ vehicleId: v3.id, driverId: d2.id, origin: "İstanbul", destination: "İzmir", distanceKm: 480, tonnage: 9, price: 18500, finalStatus: ShipmentStatus.EN_ROUTE, createdAt: hoursAgo(6), priceApproved: true });
  await shipment({ vehicleId: v4.id, driverId: d3.id, origin: "İstanbul", destination: "Ankara", distanceKm: 450, tonnage: 11, price: 16000, finalStatus: ShipmentStatus.HEADING_TO_PICKUP, createdAt: hoursAgo(4), priceApproved: true });
  // Assigned, awaiting customer price approval — demonstrates the approval flow.
  await shipment({ vehicleId: v1.id, driverId: d1.id, origin: "Bursa", destination: "Antalya", distanceKm: 540, tonnage: 13, price: 21000, finalStatus: ShipmentStatus.ASSIGNED, createdAt: hoursAgo(3) });
  // Waiting to be assigned (shows in the Atama screen).
  await shipment({ vehicleId: null, driverId: null, origin: "İzmir", destination: "Konya", distanceKm: 330, tonnage: 8, price: null, finalStatus: ShipmentStatus.PENDING, createdAt: hoursAgo(2) });
  // Open on the marketplace (no supplier yet — shows in Pazaryeri).
  await shipment({ vehicleId: null, driverId: null, origin: "Ankara", destination: "İzmir", distanceKm: 580, tonnage: 10, price: null, finalStatus: ShipmentStatus.PENDING, createdAt: hoursAgo(1), supplierNull: true });
  // Completed history — drives KPIs / trend.
  await shipment({ vehicleId: v1.id, driverId: d1.id, origin: "İstanbul", destination: "İzmir", distanceKm: 480, tonnage: 24, price: 19500, finalStatus: ShipmentStatus.COMPLETED, createdAt: hoursAgo(24), priceApproved: true });
  await shipment({ vehicleId: v2.id, driverId: d1.id, origin: "İstanbul", destination: "Trabzon", distanceKm: 1080, tonnage: 18, price: 31000, finalStatus: ShipmentStatus.COMPLETED, createdAt: hoursAgo(48), priceApproved: true });
  await shipment({ vehicleId: v1.id, driverId: d1.id, origin: "Bursa", destination: "Antalya", distanceKm: 540, tonnage: 13, price: 21000, finalStatus: ShipmentStatus.COMPLETED, createdAt: hoursAgo(72), priceApproved: true });
}

/** Platform-admin only — the owner's list of provisioned demo sandboxes. */
export async function listDemoInstances(ctx: TenantContext) {
  requirePlatformAdmin(ctx);
  return prisma.demoInstance.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * Platform-admin only — tear a demo sandbox down immediately (revoke) and
 * delete its whole world. Deleting the two demo companies cascades to their
 * users/vehicles/drivers; shipments (which reference companies without
 * cascade) are removed first.
 */
export async function revokeDemoInstance(ctx: TenantContext, id: string) {
  requirePlatformAdmin(ctx);
  const instance = await prisma.demoInstance.findUnique({ where: { id } });
  if (!instance) throw new NotFoundError("Demo örneği bulunamadı.");
  await purgeDemoInstance(instance);
  return { id };
}

type DemoInstanceRow = {
  id: string;
  supplierCompanyId: string;
  customerCompanyId: string;
};

/**
 * Deletes a demo world in FK-safe order, then the DemoInstance row itself.
 * StatusHistory is polymorphic (entity_type/entity_id, no shipment FK), so its
 * rows are removed explicitly by entity id; shipments (whose company relations
 * are Restrict, not Cascade) go before the companies, which then cascade to
 * users/vehicles/drivers.
 */
export async function purgeDemoInstance(instance: DemoInstanceRow) {
  const companyIds = [instance.supplierCompanyId, instance.customerCompanyId];
  const shipmentWhere = {
    OR: [
      { customerCompanyId: { in: companyIds } },
      { supplierCompanyId: { in: companyIds } },
    ],
  };
  const [shipments, vehicles, drivers] = await Promise.all([
    prisma.shipment.findMany({ where: shipmentWhere, select: { id: true } }),
    prisma.vehicle.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    }),
    prisma.driver.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    }),
  ]);
  const entityIds = [
    ...shipments.map((s) => s.id),
    ...vehicles.map((v) => v.id),
    ...drivers.map((d) => d.id),
  ];

  await prisma.$transaction([
    prisma.statusHistory.deleteMany({ where: { entityId: { in: entityIds } } }),
    prisma.shipment.deleteMany({ where: shipmentWhere }),
    prisma.company.deleteMany({ where: { id: { in: companyIds } } }),
    prisma.demoInstance.delete({ where: { id: instance.id } }),
  ]);
}

/**
 * Sweeps expired demos: purges any ACTIVE instance past its expiry. Called
 * opportunistically when the owner opens the admin demo list, so there is no
 * cron dependency; safe to call as often as needed.
 */
export async function purgeExpiredDemoInstances() {
  const expired = await prisma.demoInstance.findMany({
    where: { status: DemoInstanceStatus.ACTIVE, expiresAt: { lt: new Date() } },
  });
  for (const instance of expired) {
    await purgeDemoInstance(instance);
  }
  return expired.length;
}
