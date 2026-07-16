import { z } from "zod";

import {
  DockReservationType,
  VehicleBedType,
  VehicleType,
} from "@/generated/prisma/client";
import { optionalMapsUrlSchema } from "@/lib/validation/shipment";

export const warehouseInputSchema = z.object({
  name: z.string().trim().min(2, "Depo adı en az 2 karakter olmalı.").max(120),
  address: z.string().trim().max(300).nullable().optional(),
  mapsUrl: optionalMapsUrlSchema.nullable(),
});
export type WarehouseInput = z.infer<typeof warehouseInputSchema>;

const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD formatında olmalı.");

/** One row per day of week (0=Pazar..6=Cumartesi), always all 7 present. */
export const dockWorkingHourInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    openTime: timeOfDaySchema,
    closeTime: timeOfDaySchema,
  })
  .refine((row) => !row.isOpen || row.openTime < row.closeTime, {
    message: "Kapanış saati açılış saatinden sonra olmalı.",
    path: ["closeTime"],
  });

export const dockInputSchema = z.object({
  name: z.string().trim().min(1, "Rampa adı gerekli.").max(120),
  supportedReservationTypes: z
    .array(z.nativeEnum(DockReservationType, "Geçerli bir rezervasyon tipi seçin."))
    .min(1, "En az bir rezervasyon tipi seçmelisiniz."),
  supportedVehicleTypes: z
    .array(z.nativeEnum(VehicleType, "Geçerli bir araç tipi seçin."))
    .min(1, "En az bir araç tipi seçmelisiniz."),
  supportedBedTypes: z
    .array(z.nativeEnum(VehicleBedType, "Geçerli bir kasa tipi seçin."))
    .min(1, "En az bir kasa tipi seçmelisiniz."),
  slotDurationMinutes: z.coerce
    .number("Rezervasyon süresi sayısal olmalı.")
    .int()
    .min(15, "Rezervasyon süresi en az 15 dakika olmalı.")
    .max(480, "Rezervasyon süresi çok uzun."),
  workingHours: z.array(dockWorkingHourInputSchema).length(7),
});
export type DockInput = z.infer<typeof dockInputSchema>;

export const reservationInputSchema = z.object({
  reservationType: z.nativeEnum(
    DockReservationType,
    "Geçerli bir rezervasyon tipi seçin."
  ),
  startAt: z.coerce.date("Geçerli bir başlangıç zamanı seçin."),
  reason: z.string().trim().min(2, "Rezervasyon gerekçesi gerekli.").max(200),
  vehicleType: z.nativeEnum(VehicleType).nullable().optional(),
  cargoType: z.string().trim().max(120).nullable().optional(),
  quantity: z.coerce.number().int().positive().nullable().optional(),
  totalWeightKg: z.coerce.number().positive().nullable().optional(),
  plate: z.string().trim().min(4, "Geçerli bir plaka girin.").max(15).toUpperCase(),
  driverName: z.string().trim().min(2, "Sürücü adı gerekli.").max(120),
  driverPhone: z.string().trim().max(30).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  shipmentId: z.string().uuid().nullable().optional(),
});
export type ReservationInput = z.infer<typeof reservationInputSchema>;
