import { z } from "zod";

/**
 * The public "Demo Talep Et" lead form (src/app/demo). Pure contact capture —
 * no account is created from it. vehicleCount arrives from FormData as a
 * string, hence z.coerce.
 */
export const demoRequestInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı.")
    .max(100, "Ad soyad çok uzun."),
  companyName: z
    .string()
    .trim()
    .min(2, "Firma adı en az 2 karakter olmalı.")
    .max(120, "Firma adı çok uzun."),
  phone: z
    .string()
    .trim()
    .min(7, "Geçerli bir telefon girin.")
    .max(30, "Telefon çok uzun."),
  email: z.email("Geçerli bir e-posta girin."),
  vehicleCount: z.coerce
    .number("Araç sayısını girin.")
    .int("Araç sayısı tam sayı olmalı.")
    .min(0, "Araç sayısı 0 veya daha fazla olmalı.")
    .max(100000, "Araç sayısı çok yüksek."),
  message: z
    .string()
    .trim()
    .max(1000, "Mesaj çok uzun.")
    .optional()
    .or(z.literal("")),
});
export type DemoRequestInput = z.infer<typeof demoRequestInputSchema>;
