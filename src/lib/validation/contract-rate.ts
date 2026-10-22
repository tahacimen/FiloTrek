import { z } from "zod";

import { isValidDistrict, isValidProvince } from "@/lib/tr-cities";
import { ContractPricingMethod } from "@/generated/prisma/enums";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

// G2: a supplier's contract rate for one customer. LANE_FIXED needs a valid
// destination province (district optional but must belong to it); PER_KM /
// PER_TON ignore the destination entirely.
export const contractRateInputSchema = z
  .object({
    customerCompanyId: z.uuid("Geçerli bir müşteri seçin."),
    method: z.nativeEnum(ContractPricingMethod, "Bir fiyatlandırma yöntemi seçin."),
    destinationProvince: z.preprocess(
      emptyToNull,
      z.string().trim().max(50).nullable()
    ),
    destinationDistrict: z.preprocess(
      emptyToNull,
      z.string().trim().max(50).nullable()
    ),
    amount: z.coerce
      .number("Tutar sayısal olmalı.")
      .positive("Tutar pozitif olmalı.")
      .max(100000000, "Tutar çok yüksek."),
  })
  .refine(
    (v) =>
      v.method !== ContractPricingMethod.LANE_FIXED ||
      (v.destinationProvince !== null && isValidProvince(v.destinationProvince)),
    {
      message: "Hat bazlı fiyat için geçerli bir teslim ili seçin.",
      path: ["destinationProvince"],
    }
  )
  .refine(
    (v) =>
      v.method !== ContractPricingMethod.LANE_FIXED ||
      v.destinationDistrict === null ||
      (v.destinationProvince !== null &&
        isValidDistrict(v.destinationProvince, v.destinationDistrict)),
    {
      message: "İlçe, seçilen ile ait olmalı.",
      path: ["destinationDistrict"],
    }
  )
  .transform((v) => ({
    ...v,
    // Only LANE_FIXED stores a destination; clear it for the rate-based methods
    // so a stale province can never accidentally scope a PER_KM/PER_TON rate.
    destinationProvince:
      v.method === ContractPricingMethod.LANE_FIXED ? v.destinationProvince : null,
    destinationDistrict:
      v.method === ContractPricingMethod.LANE_FIXED ? v.destinationDistrict : null,
  }));

export type ContractRateInput = z.infer<typeof contractRateInputSchema>;
