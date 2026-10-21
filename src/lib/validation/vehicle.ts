import { z } from "zod";

import { VehicleBedType, VehicleType } from "@/generated/prisma/client";

// N1: vehicle documents are legally required, so these are now mandatory on
// every create/edit. No rigid format is imposed (ruhsat/poliçe numbers vary by
// issuer) — only a non-empty, reasonable-length value. The DB columns stay
// nullable on purpose: pre-existing vehicles created before this rule keep
// their empty values and are surfaced with a "belge eksik" flag (see
// src/lib/vehicle-docs.ts) rather than being blocked, and are completed the
// next time they're edited through this schema.
const requiredDocDate = z.coerce.date("Geçerli bir tarih girin.");

const requiredDocText = (max: number) =>
  z
    .string("Bu alan zorunludur.")
    .trim()
    .min(3, "En az 3 karakter girin.")
    .max(max, "Çok uzun.");

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
  // Belge geçerlilik takibi — N1: hepsi zorunlu (bkz. src/lib/vehicle-docs.ts).
  registrationNumber: requiredDocText(50),
  insurancePolicyNumber: requiredDocText(50),
  inspectionExpiry: requiredDocDate,
  insuranceExpiry: requiredDocDate,
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;
