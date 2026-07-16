import { z } from "zod";

import { InvitationRole } from "@/generated/prisma/client";

export const invitationInputSchema = z.object({
  email: z.email("Geçerli bir e-posta girin."),
  role: z.nativeEnum(InvitationRole, "Geçerli bir rol seçin."),
});
export type InvitationInput = z.infer<typeof invitationInputSchema>;

export const invitationAcceptInputSchema = z.object({
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
  password: z.string().trim().min(8, "Şifre en az 8 karakter olmalı."),
});
export type InvitationAcceptInput = z.infer<typeof invitationAcceptInputSchema>;

export const manualAccountInputSchema = invitationInputSchema.extend(
  invitationAcceptInputSchema.shape
);
export type ManualAccountInput = z.infer<typeof manualAccountInputSchema>;
