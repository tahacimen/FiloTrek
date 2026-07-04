import { z } from "zod";

export const gateGuardInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı.")
    .max(100, "Ad soyad çok uzun."),
  email: z.email("Geçerli bir e-posta girin."),
  // Required the first time (create), optional on edit — blank keeps the
  // existing hash. Unlike Driver, login here is never opt-in, so this
  // create-vs-edit distinction (which depends on existing DB state the
  // schema itself can't see) is enforced in gate-guard-service.ts.
  password: z
    .string()
    .trim()
    .min(8, "Şifre en az 8 karakter olmalı.")
    .optional(),
});
export type GateGuardInput = z.infer<typeof gateGuardInputSchema>;
