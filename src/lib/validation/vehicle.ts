import { z } from "zod";

import { VehicleBedType, VehicleType } from "@/generated/prisma/client";

// Empty form fields arrive as "" — normalize those to null so an unset (or
// cleared) document field is stored/cleared rather than failing validation.
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalDocDate = z.preprocess(
  emptyToNull,
  z.coerce.date("Geçerli bir tarih girin.").nullable()
);

const optionalDocText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, "Çok uzun.").nullable());

export const vehicleInputSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(4, "Geçerli bir plaka girin.")
    .max(15, "Plaka çok uzun.")
    .toUpperCase(),
  vehicleType: z.nativeEnum(VehicleType, "Geçerli bir araç tipi seçin."),
  bedType: z.nativeEnum(VehicleBedType, "Geçerli bir kasa tipi seçin."),
  tonnageCapacity: z.coerce
    .number("Tonaj sayısal bir değer olmalı.")
    .positive("Tonaj pozitif bir değer olmalı.")
    .max(200, "Tonaj değeri çok yüksek."),
  // Belge geçerlilik takibi — hepsi opsiyonel (bkz. src/lib/vehicle-docs.ts).
  registrationNumber: optionalDocText(50).default(null),
  insurancePolicyNumber: optionalDocText(50).default(null),
  inspectionExpiry: optionalDocDate.default(null),
  insuranceExpiry: optionalDocDate.default(null),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;
