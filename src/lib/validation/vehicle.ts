import { z } from "zod";

import { VehicleBedType, VehicleType } from "@/generated/prisma/client";
import { DEFAULT_COUNTRY, isValidCountry, plateError } from "@/lib/countries";

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

export const vehicleInputSchema = z
  .object({
    // A1: registration country (default TR). An empty/absent value falls back
    // to TR so older forms and callers keep working.
    country: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : DEFAULT_COUNTRY),
      z.string()
    ),
    plate: z
      .string()
      .trim()
      .min(2, "Plaka girin.")
      .max(20, "Plaka çok uzun.")
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
  })
  // A1: the plate must match the chosen country's rule — strict for TR, lenient
  // for the rest (see src/lib/countries.ts).
  .superRefine((val, ctx) => {
    if (!isValidCountry(val.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["country"],
        message: "Geçerli bir ülke seçin.",
      });
      return;
    }
    const err = plateError(val.country, val.plate);
    if (err) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["plate"], message: err });
    }
  });

export type VehicleInput = z.infer<typeof vehicleInputSchema>;
