import { z } from "zod";

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
