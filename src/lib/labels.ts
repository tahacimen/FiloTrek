import {
  CompanyType,
  DockReservationStatus,
  DockReservationType,
  DriverStatus,
  InvitationRole,
  InvitationStatus,
  ShipmentStatus,
  VehicleBedType,
  VehicleStatus,
  VehicleType,
} from "@/generated/prisma/enums";

export const vehicleTypeLabels: Record<VehicleType, string> = {
  [VehicleType.TIR]: "Tır",
  [VehicleType.KAMYON]: "Kamyon",
  [VehicleType.KAMYONET]: "Kamyonet",
  [VehicleType.PANELVAN]: "Panelvan",
};

export const vehicleBedTypeLabels: Record<VehicleBedType, string> = {
  [VehicleBedType.ACIK_KASA]: "Açık Kasa",
  [VehicleBedType.KAPALI_KASA]: "Kapalı Kasa",
  [VehicleBedType.TENTELI]: "Tenteli",
  [VehicleBedType.FRIGORIFIK]: "Frigorifik",
  [VehicleBedType.KONTEYNER]: "Konteyner",
  [VehicleBedType.LOWBED]: "Lowbed",
};

export const vehicleStatusLabels: Record<VehicleStatus, string> = {
  [VehicleStatus.AVAILABLE]: "Müsait",
  [VehicleStatus.ASSIGNED]: "Atandı",
  [VehicleStatus.HEADING_TO_PICKUP]: "Yüklemeye Gidiyor",
  [VehicleStatus.LOADING]: "Yüklemede",
  [VehicleStatus.EN_ROUTE]: "Yolda",
  [VehicleStatus.AT_DELIVERY_POINT]: "Teslimat Noktasında",
  [VehicleStatus.MAINTENANCE]: "Bakımda",
};

export const driverStatusLabels: Record<DriverStatus, string> = {
  [DriverStatus.AVAILABLE]: "Müsait",
  [DriverStatus.ON_TRIP]: "Seferde",
  [DriverStatus.OFF_DUTY]: "İzinde",
};

export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  [ShipmentStatus.PENDING]: "Atama Bekliyor",
  [ShipmentStatus.ASSIGNED]: "Atandı",
  [ShipmentStatus.HEADING_TO_PICKUP]: "Yüklemeye Gidiyor",
  [ShipmentStatus.LOADING]: "Yüklemede",
  [ShipmentStatus.AT_PICKUP_GATE]: "Yüklemeye Hazır",
  [ShipmentStatus.EN_ROUTE]: "Yolda",
  [ShipmentStatus.AT_DELIVERY_POINT]: "Teslimat Noktasında",
  [ShipmentStatus.COMPLETED]: "Tamamlandı",
  [ShipmentStatus.CANCELLED]: "İptal Edildi",
};

/**
 * Customer-facing override: HEADING_TO_PICKUP reads "Gidiyor" (leaving) from
 * the supplier's own perspective — used as-is for their action button and
 * status badges — but the same vehicle is "Geliyor" (arriving) from the
 * customer's side. Every other status reads identically for both roles.
 */
export const customerShipmentStatusLabels: Record<ShipmentStatus, string> = {
  ...shipmentStatusLabels,
  [ShipmentStatus.HEADING_TO_PICKUP]: "Yüklemeye Geliyor",
};

/**
 * The driver's own action-button text, keyed by the shipment's CURRENT
 * status — deliberately worded as first-person actions ("Vardım", "Aldım")
 * rather than the passive/state-describing shipmentStatusLabels, matching
 * DRIVER_NEXT_TARGET_STATUS in shipment-transitions.ts.
 */
export const driverNextStepLabels: Partial<Record<ShipmentStatus, string>> = {
  [ShipmentStatus.HEADING_TO_PICKUP]: "Yükleme Noktasına Vardım",
  [ShipmentStatus.LOADING]: "Depo Kapısına Vardım",
  [ShipmentStatus.AT_PICKUP_GATE]: "Malı Teslim Aldım, Yola Çıkıyorum",
  [ShipmentStatus.EN_ROUTE]: "Teslimat Noktasına Vardım",
  [ShipmentStatus.AT_DELIVERY_POINT]: "Malı Teslim Ettim",
};

export const companyTypeLabels: Record<CompanyType, string> = {
  [CompanyType.SUPPLIER]: "Tedarikçi",
  [CompanyType.CUSTOMER]: "Müşteri",
};

export const dockReservationTypeLabels: Record<DockReservationType, string> = {
  [DockReservationType.LOADING]: "Yükleme",
  [DockReservationType.UNLOADING]: "Boşaltma",
};

export const dockReservationStatusLabels: Record<DockReservationStatus, string> = {
  [DockReservationStatus.CREATED]: "Oluşturuldu",
  [DockReservationStatus.VEHICLE_ARRIVED]: "Araç Geldi",
  [DockReservationStatus.COMPLETED]: "Tamamlandı",
  [DockReservationStatus.CANCELLED]: "İptal Edildi",
};

export const dockReservationStatusBadgeVariant: Record<
  DockReservationStatus,
  "default" | "secondary" | "outline" | "destructive" | "success" | "warning"
> = {
  [DockReservationStatus.CREATED]: "default",
  [DockReservationStatus.VEHICLE_ARRIVED]: "warning",
  [DockReservationStatus.COMPLETED]: "success",
  [DockReservationStatus.CANCELLED]: "destructive",
};

export const invitationRoleLabels: Record<InvitationRole, string> = {
  [InvitationRole.SUPPLIER_COMPANY]: "Tedarikçi",
  [InvitationRole.CUSTOMER_COMPANY]: "Müşteri",
};

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  [InvitationStatus.PENDING]: "Bekliyor",
  [InvitationStatus.ACCEPTED]: "Kabul Edildi",
  [InvitationStatus.REVOKED]: "İptal Edildi",
};

export const invitationStatusBadgeVariant: Record<
  InvitationStatus,
  "default" | "secondary" | "outline" | "destructive" | "success" | "warning"
> = {
  [InvitationStatus.PENDING]: "warning",
  [InvitationStatus.ACCEPTED]: "success",
  [InvitationStatus.REVOKED]: "destructive",
};

/** Badge color variant per status, shared by vehicle/driver/shipment status chips. */
export const statusBadgeVariant: Record<
  VehicleStatus | DriverStatus | ShipmentStatus,
  "default" | "secondary" | "outline" | "destructive" | "success" | "warning"
> = {
  AVAILABLE: "success",
  ASSIGNED: "default",
  HEADING_TO_PICKUP: "default",
  LOADING: "warning",
  AT_PICKUP_GATE: "warning",
  EN_ROUTE: "default",
  AT_DELIVERY_POINT: "warning",
  MAINTENANCE: "secondary",
  ON_TRIP: "default",
  OFF_DUTY: "secondary",
  PENDING: "secondary",
  COMPLETED: "success",
  CANCELLED: "destructive",
};
