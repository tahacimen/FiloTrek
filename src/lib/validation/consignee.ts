import { z } from "zod";

import { isValidDistrict, isValidProvince } from "@/lib/tr-cities";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, "Çok uzun.").nullable());

// C1: a customer's cari / consignee. Province & district must be a real pair
// from the 81-il dataset (src/lib/tr-cities.ts) — enforced with a cross-field
// refine so a district can never belong to the wrong province.
export const consigneeInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Ünvan en az 2 karakter olmalı.")
      .max(150, "Ünvan çok uzun."),
    province: z.string().trim().min(1, "İl seçin."),
    district: z.string().trim().min(1, "İlçe seçin."),
    address: optionalText(300),
    phone: optionalText(30),
    taxNumber: optionalText(20),
  })
  .refine((v) => isValidProvince(v.province), {
    message: "Geçerli bir il seçin.",
    path: ["province"],
  })
  .refine((v) => isValidDistrict(v.province, v.district), {
    message: "Seçilen ile ait geçerli bir ilçe seçin.",
    path: ["district"],
  });

export type ConsigneeInput = z.infer<typeof consigneeInputSchema>;
