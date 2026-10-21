import { z } from "zod";

import { DriverDeactivationReason, DriverStatus } from "@/generated/prisma/enums";

export const driverInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı.")
    .max(100, "Ad soyad çok uzun."),
  phone: z
    .string()
    .trim()
    .min(7, "Geçerli bir telefon numarası girin.")
    .max(20, "Telefon numarası çok uzun."),
  licenseNumber: z
    .string()
    .trim()
    .min(3, "Ehliyet numarası en az 3 karakter olmalı.")
    .max(30, "Ehliyet numarası çok uzun.")
    // N3: no single national ehliyet-no format exists, so we don't impose a
    // rigid pattern that could reject a valid licence — only that it's
    // letters/digits (no spaces or punctuation), normalized to upper case.
    .regex(
      /^[a-zA-Z0-9]+$/,
      "Ehliyet numarası yalnızca harf ve rakamlardan oluşmalı."
    )
    .toUpperCase(),
  // Login is opt-in — email/password are only meaningful together, but that
  // cross-field + create-vs-edit rule ("password required the first time
  // login is enabled, optional afterwards") depends on existing DB state
  // the schema itself can't see, so it's enforced in driver-service.ts
  // instead of here.
  email: z.email("Geçerli bir e-posta girin.").optional(),
  password: z
    .string()
    .trim()
    .min(8, "Şifre en az 8 karakter olmalı.")
    .optional(),
  tcNumber: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "TC Kimlik No 11 haneli olmalı.")
    .optional(),
  experienceYears: z.coerce
    .number("Deneyim yılı sayısal olmalı.")
    .int("Deneyim yılı tam sayı olmalı.")
    .min(0, "Deneyim yılı negatif olamaz.")
    .max(60, "Deneyim yılı çok yüksek.")
    .optional(),
});

export type DriverInput = z.infer<typeof driverInputSchema>;

// N2: the dispatcher's manual status toggle. Only the two manually-settable
// states are allowed — ON_TRIP is driven exclusively by the shipment
// lifecycle, never set by hand (see src/lib/driver-status.ts).
export const driverManualStatusSchema = z.object({
  status: z.enum(
    [DriverStatus.AVAILABLE, DriverStatus.OFF_DUTY],
    "Geçerli bir durum seçin."
  ),
});

export type DriverManualStatusInput = z.infer<typeof driverManualStatusSchema>;

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

// N2: date-range leave. Either both dates are set (a real window) or both are
// cleared (leave removed). end must not precede start.
export const driverLeaveSchema = z
  .object({
    leaveStartDate: z.preprocess(
      emptyToNull,
      z.coerce.date("Geçerli bir başlangıç tarihi girin.").nullable()
    ),
    leaveEndDate: z.preprocess(
      emptyToNull,
      z.coerce.date("Geçerli bir bitiş tarihi girin.").nullable()
    ),
  })
  .refine(
    (v) =>
      (v.leaveStartDate === null) === (v.leaveEndDate === null),
    { message: "İzin için başlangıç ve bitiş tarihinin ikisi de girilmeli.", path: ["leaveEndDate"] }
  )
  .refine(
    (v) =>
      v.leaveStartDate === null ||
      v.leaveEndDate === null ||
      v.leaveEndDate >= v.leaveStartDate,
    { message: "Bitiş tarihi başlangıçtan önce olamaz.", path: ["leaveEndDate"] }
  );

export type DriverLeaveInput = z.infer<typeof driverLeaveSchema>;

// N7: permanent deactivation. A reason is always required; a free-text note is
// required specifically for OTHER (and optional otherwise) so the "Diğer"
// bucket still carries an explanation.
export const driverDeactivationSchema = z
  .object({
    reason: z.nativeEnum(
      DriverDeactivationReason,
      "Bir devre dışı bırakma nedeni seçin."
    ),
    note: z.preprocess(
      emptyToNull,
      z.string().trim().max(300, "Not çok uzun.").nullable()
    ),
  })
  .refine((v) => v.reason !== DriverDeactivationReason.OTHER || v.note !== null, {
    message: "\"Diğer\" seçildiğinde bir açıklama girmelisiniz.",
    path: ["note"],
  });

export type DriverDeactivationInput = z.infer<typeof driverDeactivationSchema>;
