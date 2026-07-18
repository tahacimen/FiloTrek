import { z } from "zod";

import { InvitationRole } from "@/generated/prisma/client";

/**
 * The public "Kaydol" application form (src/app/kaydol). Mirrors the field
 * rules used by the invitation-accept + manual-account schemas so an admin
 * can later reuse these exact values to create the real account, but adds the
 * bits a cold applicant supplies themselves: their phone and a free-text note.
 * No password here — the applicant never sets one; the admin does that later.
 */
export const signupRequestInputSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Firma adı en az 2 karakter olmalı.")
    .max(120, "Firma adı çok uzun."),
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı.")
    .max(100, "Ad soyad çok uzun."),
  email: z.email("Geçerli bir e-posta girin."),
  phone: z
    .string()
    .trim()
    .max(30, "Telefon çok uzun.")
    .optional()
    .or(z.literal("")),
  role: z.nativeEnum(InvitationRole, "Hesap türünü seçin."),
  message: z
    .string()
    .trim()
    .max(1000, "Mesaj çok uzun.")
    .optional()
    .or(z.literal("")),
});
export type SignupRequestInput = z.infer<typeof signupRequestInputSchema>;
