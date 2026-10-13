import { z } from "zod";

const emptyToNull = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "")
    ? null
    : v;

export const driverBlockInputSchema = z
  .object({
    fullName: z.preprocess(
      emptyToNull,
      z.string().trim().max(120, "İsim çok uzun.").nullable()
    ),
    tcNumber: z.preprocess(
      emptyToNull,
      z
        .string()
        .trim()
        .regex(/^\d{11}$/, "TC kimlik numarası 11 haneli olmalı.")
        .nullable()
    ),
    licenseNumber: z.preprocess(
      emptyToNull,
      z.string().trim().toUpperCase().max(50, "Ehliyet no çok uzun.").nullable()
    ),
    reason: z.preprocess(
      emptyToNull,
      z.string().trim().max(300, "Açıklama çok uzun.").nullable()
    ),
  })
  .refine((d) => d.tcNumber !== null || d.licenseNumber !== null, {
    message: "TC veya ehliyet numarasından en az biri gereklidir.",
    path: ["tcNumber"],
  });

export type DriverBlockInput = z.infer<typeof driverBlockInputSchema>;
