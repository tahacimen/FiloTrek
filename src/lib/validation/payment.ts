import { z } from "zod";

import { PaymentStatus } from "@/generated/prisma/client";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

export const shipmentPaymentInputSchema = z.object({
  status: z.nativeEnum(PaymentStatus, "Geçerli bir ödeme durumu seçin."),
  dueDate: z.preprocess(
    emptyToNull,
    z.coerce.date("Geçerli bir vade tarihi girin.").nullable()
  ),
});

export type ShipmentPaymentInput = z.infer<typeof shipmentPaymentInputSchema>;
