import { hash } from "bcryptjs";

import { prisma } from "../src/lib/db";
import {
  CompanyRole,
  CompanyType,
  DriverStatus,
  ShipmentStatus,
  StatusChangeSource,
  StatusEntityType,
  VehicleBedType,
  VehicleStatus,
  VehicleType,
} from "../src/generated/prisma/client";

const DEMO_PASSWORD = "Demo1234!";

function daysAgo(n: number, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Creates the full demo dataset. Deliberately does NO deleting of its own —
 * the dev entry (prisma/seed.ts) wipes first, and the production entry
 * (prisma/seed-prod.ts) only ever calls this against an already-empty DB.
 * Kept in its own module with no top-level execution so both entries can
 * import it without triggering a seed as a side effect.
 */
export async function seedDatabase() {
  const passwordHash = await hash(DEMO_PASSWORD, 10);

  // --- Companies -----------------------------------------------------------
  const anadolu = await prisma.company.create({
    data: {
      name: "Anadolu Nakliyat A.Ş.",
      type: "SUPPLIER",
      taxNumber: "1234567890",
      address: "Hadımköy, İstanbul",
      phone: "0212 555 10 10",
    },
  });

  const marmara = await prisma.company.create({
    data: {
      name: "Marmara Lojistik Ltd. Şti.",
      type: "SUPPLIER",
      taxNumber: "2234567890",
      address: "Gebze, Kocaeli",
      phone: "0262 555 20 20",
    },
  });

  const egeTekstil = await prisma.company.create({
    data: {
      name: "Ege Tekstil San. ve Tic. A.Ş.",
      type: "CUSTOMER",
      taxNumber: "3234567890",
      address: "Bornova, İzmir",
      phone: "0232 555 30 30",
    },
  });

  const karadenizGida = await prisma.company.create({
    data: {
      name: "Karadeniz Gıda Ürünleri A.Ş.",
      type: "CUSTOMER",
      taxNumber: "4234567890",
      address: "Ortahisar, Trabzon",
      phone: "0462 555 40 40",
    },
  });

  // --- Gate guards ("Nizamiye") — CUSTOMER-side only -----------------------
  await prisma.gateGuard.create({
    data: {
      companyId: egeTekstil.id,
      fullName: "Nizamiye Görevlisi (Ege Tekstil)",
      email: "nizamiye@egetekstil.com",
      passwordHash,
    },
  });

  // --- Users -----------------------------------------------------------------
  await prisma.user.createMany({
    data: [
      {
        companyId: anadolu.id,
        email: "thcmn4444@gmail.com",
        passwordHash,
        fullName: "Taha Çimen",
        companyRole: CompanyRole.ADMIN,
        // Site sahibi — /admin (davetler + kayıt talepleri) yalnızca
        // platform admin'e açık, bkz. schema'daki Invitation yorumu.
        isPlatformAdmin: true,
      },
      {
        companyId: anadolu.id,
        email: "mehmet@anadolunakliyat.com",
        passwordHash,
        fullName: "Mehmet Yılmaz",
        phone: "0532 111 11 11",
        companyRole: CompanyRole.ADMIN,
      },
      {
        companyId: marmara.id,
        email: "ayse@marmaralojistik.com",
        passwordHash,
        fullName: "Ayşe Kaya",
        phone: "0532 222 22 22",
        companyRole: CompanyRole.ADMIN,
      },
      {
        companyId: egeTekstil.id,
        email: "fatma@egetekstil.com",
        passwordHash,
        fullName: "Fatma Demir",
        phone: "0532 333 33 33",
        companyRole: CompanyRole.ADMIN,
      },
      {
        companyId: karadenizGida.id,
        email: "ali@karadenizgida.com",
        passwordHash,
        fullName: "Ali Şahin",
        phone: "0532 444 44 44",
        companyRole: CompanyRole.ADMIN,
      },
    ],
  });
  const anadoluDispatcher = await prisma.user.findUniqueOrThrow({
    where: { email: "mehmet@anadolunakliyat.com" },
  });
  const marmaraDispatcher = await prisma.user.findUniqueOrThrow({
    where: { email: "ayse@marmaralojistik.com" },
  });

  // --- Vehicles ----------------------------------------------------------
  const [an101, an102, an103, an104, an105, , an107] = await Promise.all(
    [
      { plate: "34 AN 101", vehicleType: VehicleType.TIR, bedType: VehicleBedType.TENTELI, tonnageCapacity: 25, status: VehicleStatus.AVAILABLE },
      { plate: "34 AN 102", vehicleType: VehicleType.TIR, bedType: VehicleBedType.FRIGORIFIK, tonnageCapacity: 22, status: VehicleStatus.AVAILABLE },
      { plate: "34 AN 103", vehicleType: VehicleType.KAMYON, bedType: VehicleBedType.KAPALI_KASA, tonnageCapacity: 10, status: VehicleStatus.EN_ROUTE },
      { plate: "34 AN 104", vehicleType: VehicleType.KAMYON, bedType: VehicleBedType.ACIK_KASA, tonnageCapacity: 12, status: VehicleStatus.HEADING_TO_PICKUP },
      { plate: "34 AN 105", vehicleType: VehicleType.KAMYONET, bedType: VehicleBedType.KAPALI_KASA, tonnageCapacity: 3, status: VehicleStatus.ASSIGNED },
      { plate: "34 AN 106", vehicleType: VehicleType.TIR, bedType: VehicleBedType.KONTEYNER, tonnageCapacity: 27, status: VehicleStatus.MAINTENANCE },
      { plate: "34 AN 107", vehicleType: VehicleType.KAMYON, bedType: VehicleBedType.LOWBED, tonnageCapacity: 15, status: VehicleStatus.AT_DELIVERY_POINT },
    ].map((data) => prisma.vehicle.create({ data: { ...data, companyId: anadolu.id } }))
  );

  const [ml201, ml202, ml203, ml204, ml205] = await Promise.all(
    [
      { plate: "16 ML 201", vehicleType: VehicleType.TIR, bedType: VehicleBedType.TENTELI, tonnageCapacity: 24, status: VehicleStatus.AVAILABLE },
      { plate: "16 ML 202", vehicleType: VehicleType.KAMYON, bedType: VehicleBedType.KAPALI_KASA, tonnageCapacity: 8, status: VehicleStatus.AVAILABLE },
      { plate: "16 ML 203", vehicleType: VehicleType.KAMYONET, bedType: VehicleBedType.ACIK_KASA, tonnageCapacity: 2.5, status: VehicleStatus.AVAILABLE },
      { plate: "16 ML 204", vehicleType: VehicleType.TIR, bedType: VehicleBedType.FRIGORIFIK, tonnageCapacity: 20, status: VehicleStatus.LOADING },
      { plate: "16 ML 205", vehicleType: VehicleType.KAMYON, bedType: VehicleBedType.KONTEYNER, tonnageCapacity: 14, status: VehicleStatus.EN_ROUTE },
      { plate: "16 ML 206", vehicleType: VehicleType.TIR, bedType: VehicleBedType.TENTELI, tonnageCapacity: 26, status: VehicleStatus.MAINTENANCE },
    ].map((data) => prisma.vehicle.create({ data: { ...data, companyId: marmara.id } }))
  );

  // --- Drivers -------------------------------------------------------------
  const [hasan, mustafa, ibrahim, huseyin, , kadir] = await Promise.all(
    [
      { fullName: "Hasan Öztürk", phone: "0533 101 01 01", licenseNumber: "34DR1001", status: DriverStatus.AVAILABLE },
      { fullName: "Mustafa Aydın", phone: "0533 101 01 02", licenseNumber: "34DR1002", status: DriverStatus.ON_TRIP },
      { fullName: "İbrahim Çelik", phone: "0533 101 01 03", licenseNumber: "34DR1003", status: DriverStatus.ON_TRIP },
      { fullName: "Hüseyin Arslan", phone: "0533 101 01 04", licenseNumber: "34DR1004", status: DriverStatus.ON_TRIP, email: "huseyin@anadolunakliyat.com", passwordHash, tcNumber: "12345678901", experienceYears: 8 },
      { fullName: "Osman Kurt", phone: "0533 101 01 05", licenseNumber: "34DR1005", status: DriverStatus.OFF_DUTY },
      { fullName: "Kadir Şimşek", phone: "0533 101 01 06", licenseNumber: "34DR1006", status: DriverStatus.ON_TRIP },
    ].map((data) => prisma.driver.create({ data: { ...data, companyId: anadolu.id } }))
  );

  const [kemal, serkanD, emre, burak, volkan] = await Promise.all(
    [
      { fullName: "Kemal Yıldız", phone: "0533 202 02 01", licenseNumber: "16DR2001", status: DriverStatus.AVAILABLE },
      { fullName: "Serkan Doğan", phone: "0533 202 02 02", licenseNumber: "16DR2002", status: DriverStatus.AVAILABLE },
      { fullName: "Emre Koç", phone: "0533 202 02 03", licenseNumber: "16DR2003", status: DriverStatus.ON_TRIP, email: "emre@marmaralojistik.com", passwordHash, tcNumber: "23456789012", experienceYears: 5 },
      { fullName: "Burak Şen", phone: "0533 202 02 04", licenseNumber: "16DR2004", status: DriverStatus.ON_TRIP },
      { fullName: "Volkan Aksoy", phone: "0533 202 02 05", licenseNumber: "16DR2005", status: DriverStatus.AVAILABLE },
    ].map((data) => prisma.driver.create({ data: { ...data, companyId: marmara.id } }))
  );

  // --- Helper: create a shipment with a matching StatusHistory trail --------
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

  async function createShipmentWithHistory(opts: {
    customerCompanyId: string;
    supplierCompanyId: string;
    vehicleId: string;
    driverId: string;
    origin: string;
    destination: string;
    distanceKm: number;
    tonnage: number;
    price: number;
    finalStatus: ShipmentStatus;
    createdAt: Date;
    changedByUserId: string;
    documentTrackingNumber?: string;
    pickupGateInfo?: string;
    pickupMapsUrl?: string;
    loadReadyAt?: Date;
  }) {
    const targetIndex = ACTIVE_SEQUENCE.indexOf(opts.finalStatus);
    const isCompleted = opts.finalStatus === ShipmentStatus.COMPLETED;
    const reachedHeadingToPickup =
      targetIndex >= ACTIVE_SEQUENCE.indexOf(ShipmentStatus.HEADING_TO_PICKUP);

    const shipment = await prisma.shipment.create({
      data: {
        customerCompanyId: opts.customerCompanyId,
        supplierCompanyId: opts.supplierCompanyId,
        vehicleId: opts.vehicleId,
        driverId: opts.driverId,
        originAddress: opts.origin,
        destinationAddress: opts.destination,
        distanceKm: opts.distanceKm,
        tonnage: opts.tonnage,
        agreedPrice: opts.price,
        priceProposedBy: CompanyType.SUPPLIER,
        priceApprovedAt: reachedHeadingToPickup
          ? new Date(opts.createdAt.getTime() + 15 * 60 * 1000)
          : null,
        status: opts.finalStatus,
        createdAt: opts.createdAt,
        completedAt: isCompleted ? opts.createdAt : null,
        documentTrackingNumber: opts.documentTrackingNumber,
        pickupGateInfo: opts.pickupGateInfo,
        pickupMapsUrl: opts.pickupMapsUrl,
        loadReadyAt: opts.loadReadyAt,
      },
    });

    const historyRows = ACTIVE_SEQUENCE.slice(0, targetIndex + 1).map(
      (status, i) => ({
        entityType: StatusEntityType.SHIPMENT,
        entityId: shipment.id,
        fromStatus: i === 0 ? null : ACTIVE_SEQUENCE[i - 1],
        toStatus: status,
        changedByUserId: opts.changedByUserId,
        source: StatusChangeSource.MANUAL,
        createdAt: new Date(opts.createdAt.getTime() + i * 30 * 60 * 1000),
      })
    );
    await prisma.statusHistory.createMany({ data: historyRows });

    return shipment;
  }

  // --- Active (in-progress) shipments --------------------------------------
  await createShipmentWithHistory({
    customerCompanyId: egeTekstil.id,
    supplierCompanyId: anadolu.id,
    vehicleId: an103.id,
    driverId: ibrahim.id,
    origin: "İstanbul",
    destination: "İzmir",
    distanceKm: 480,
    tonnage: 9,
    price: 18500,
    finalStatus: ShipmentStatus.EN_ROUTE,
    createdAt: daysAgo(0, 6),
    changedByUserId: anadoluDispatcher.id,
  });

  await createShipmentWithHistory({
    customerCompanyId: karadenizGida.id,
    supplierCompanyId: anadolu.id,
    vehicleId: an104.id,
    driverId: huseyin.id,
    origin: "İstanbul",
    destination: "Trabzon",
    distanceKm: 1080,
    tonnage: 11,
    price: 32000,
    finalStatus: ShipmentStatus.HEADING_TO_PICKUP,
    createdAt: daysAgo(0, 8),
    changedByUserId: anadoluDispatcher.id,
    documentTrackingNumber: "IRS-2026-00842",
    pickupGateInfo: "B Blok, 3 No'lu Yükleme Rampası",
    pickupMapsUrl: "https://maps.google.com/?q=41.0082,28.9784",
    loadReadyAt: new Date(daysAgo(0, 8).getTime() + 45 * 60 * 1000),
  });

  await createShipmentWithHistory({
    customerCompanyId: egeTekstil.id,
    supplierCompanyId: anadolu.id,
    vehicleId: an107.id,
    driverId: kadir.id,
    origin: "Bursa",
    destination: "Antalya",
    distanceKm: 540,
    tonnage: 13,
    price: 21000,
    finalStatus: ShipmentStatus.AT_DELIVERY_POINT,
    createdAt: daysAgo(1, 7),
    changedByUserId: anadoluDispatcher.id,
  });

  await createShipmentWithHistory({
    customerCompanyId: karadenizGida.id,
    supplierCompanyId: marmara.id,
    vehicleId: ml204.id,
    driverId: emre.id,
    origin: "İstanbul",
    destination: "Samsun",
    distanceKm: 700,
    tonnage: 18,
    price: 27500,
    finalStatus: ShipmentStatus.LOADING,
    createdAt: daysAgo(0, 9),
    changedByUserId: marmaraDispatcher.id,
  });

  await createShipmentWithHistory({
    customerCompanyId: egeTekstil.id,
    supplierCompanyId: marmara.id,
    vehicleId: ml205.id,
    driverId: burak.id,
    origin: "Kocaeli",
    destination: "Konya",
    distanceKm: 480,
    tonnage: 12,
    price: 19000,
    finalStatus: ShipmentStatus.EN_ROUTE,
    createdAt: daysAgo(0, 5),
    changedByUserId: marmaraDispatcher.id,
  });

  // Priced and assigned, awaiting customer approval — demonstrates the
  // "Fiyatı Onayla" flow.
  await createShipmentWithHistory({
    customerCompanyId: karadenizGida.id,
    supplierCompanyId: anadolu.id,
    vehicleId: an105.id,
    driverId: mustafa.id,
    origin: "Antalya",
    destination: "Mersin",
    distanceKm: 210,
    tonnage: 3,
    price: 8500,
    finalStatus: ShipmentStatus.ASSIGNED,
    createdAt: daysAgo(0, 7),
    changedByUserId: anadoluDispatcher.id,
  });

  // Created but not yet matched to a vehicle/driver (PENDING).
  await prisma.shipment.create({
    data: {
      customerCompanyId: karadenizGida.id,
      supplierCompanyId: anadolu.id,
      originAddress: "İzmir",
      originMapsUrl: "https://maps.google.com/?q=38.4192,27.1287",
      destinationAddress: "Ankara",
      destinationMapsUrl: "https://maps.google.com/?q=39.9334,32.8597",
      distanceKm: 580,
      tonnage: 10,
      status: ShipmentStatus.PENDING,
      createdAt: daysAgo(0, 10),
    },
  });

  // --- Historical completed shipments (drives the dashboard trend chart) ---
  const historicalRuns: Array<{
    daysAgo: number;
    supplierCompanyId: string;
    customerCompanyId: string;
    vehicle: { id: string };
    driver: { id: string };
    dispatcherId: string;
    origin: string;
    destination: string;
    distanceKm: number;
    tonnage: number;
    price: number;
  }> = [
    { daysAgo: 14, supplierCompanyId: anadolu.id, customerCompanyId: egeTekstil.id, vehicle: an101, driver: hasan, dispatcherId: anadoluDispatcher.id, origin: "İstanbul", destination: "İzmir", distanceKm: 480, tonnage: 20, price: 17500 },
    { daysAgo: 12, supplierCompanyId: anadolu.id, customerCompanyId: karadenizGida.id, vehicle: an102, driver: mustafa, dispatcherId: anadoluDispatcher.id, origin: "İstanbul", destination: "Trabzon", distanceKm: 1080, tonnage: 18, price: 31000 },
    { daysAgo: 12, supplierCompanyId: marmara.id, customerCompanyId: egeTekstil.id, vehicle: ml201, driver: kemal, dispatcherId: marmaraDispatcher.id, origin: "Kocaeli", destination: "Konya", distanceKm: 480, tonnage: 19, price: 18500 },
    { daysAgo: 10, supplierCompanyId: marmara.id, customerCompanyId: karadenizGida.id, vehicle: ml202, driver: serkanD, dispatcherId: marmaraDispatcher.id, origin: "İstanbul", destination: "Samsun", distanceKm: 700, tonnage: 7, price: 21500 },
    { daysAgo: 8, supplierCompanyId: anadolu.id, customerCompanyId: egeTekstil.id, vehicle: an105, driver: hasan, dispatcherId: anadoluDispatcher.id, origin: "İstanbul", destination: "İzmir", distanceKm: 480, tonnage: 2.5, price: 9500 },
    { daysAgo: 8, supplierCompanyId: anadolu.id, customerCompanyId: karadenizGida.id, vehicle: an101, driver: mustafa, dispatcherId: anadoluDispatcher.id, origin: "Bursa", destination: "Trabzon", distanceKm: 1150, tonnage: 21, price: 33500 },
    { daysAgo: 6, supplierCompanyId: marmara.id, customerCompanyId: egeTekstil.id, vehicle: ml203, driver: volkan, dispatcherId: marmaraDispatcher.id, origin: "Gebze", destination: "İzmir", distanceKm: 500, tonnage: 2, price: 8500 },
    { daysAgo: 4, supplierCompanyId: anadolu.id, customerCompanyId: egeTekstil.id, vehicle: an102, driver: hasan, dispatcherId: anadoluDispatcher.id, origin: "İstanbul", destination: "İzmir", distanceKm: 480, tonnage: 21, price: 18000 },
    { daysAgo: 4, supplierCompanyId: marmara.id, customerCompanyId: karadenizGida.id, vehicle: ml201, driver: kemal, dispatcherId: marmaraDispatcher.id, origin: "Kocaeli", destination: "Samsun", distanceKm: 750, tonnage: 22, price: 28500 },
    { daysAgo: 2, supplierCompanyId: anadolu.id, customerCompanyId: karadenizGida.id, vehicle: an105, driver: mustafa, dispatcherId: anadoluDispatcher.id, origin: "İstanbul", destination: "Trabzon", distanceKm: 1080, tonnage: 2.8, price: 15000 },
    { daysAgo: 1, supplierCompanyId: marmara.id, customerCompanyId: egeTekstil.id, vehicle: ml202, driver: serkanD, dispatcherId: marmaraDispatcher.id, origin: "İstanbul", destination: "İzmir", distanceKm: 480, tonnage: 7.5, price: 13500 },
    { daysAgo: 1, supplierCompanyId: anadolu.id, customerCompanyId: egeTekstil.id, vehicle: an101, driver: hasan, dispatcherId: anadoluDispatcher.id, origin: "İstanbul", destination: "İzmir", distanceKm: 480, tonnage: 24, price: 19500 },
  ];

  for (const run of historicalRuns) {
    await createShipmentWithHistory({
      customerCompanyId: run.customerCompanyId,
      supplierCompanyId: run.supplierCompanyId,
      vehicleId: run.vehicle.id,
      driverId: run.driver.id,
      origin: run.origin,
      destination: run.destination,
      distanceKm: run.distanceKm,
      tonnage: run.tonnage,
      price: run.price,
      finalStatus: ShipmentStatus.COMPLETED,
      createdAt: daysAgo(run.daysAgo, 8),
      changedByUserId: run.dispatcherId,
    });
  }

  console.log("Demo veri yüklendi. Giriş şifresi (tüm hesaplar): %s", DEMO_PASSWORD);
  console.log("  Yönetici (Anadolu):  thcmn4444@gmail.com");
  console.log("  Tedarikçi (Anadolu): mehmet@anadolunakliyat.com");
  console.log("  Tedarikçi (Marmara): ayse@marmaralojistik.com");
  console.log("  Müşteri (Ege):       fatma@egetekstil.com");
  console.log("  Müşteri (Karadeniz): ali@karadenizgida.com");
  console.log("  Şoför (Anadolu):     huseyin@anadolunakliyat.com");
  console.log("  Şoför (Marmara):     emre@marmaralojistik.com");
  console.log("  Nizamiye (Ege):      nizamiye@egetekstil.com");
}
