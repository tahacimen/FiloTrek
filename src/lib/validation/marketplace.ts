import { z } from "zod";

/** A supplier's price offer on an open (unassigned) shipment. */
export const bidInputSchema = z.object({
  price: z.coerce
    .number("Fiyat sayısal bir değer olmalı.")
    .positive("Fiyat pozitif bir değer olmalı."),
  message: z.string().trim().max(500, "Mesaj çok uzun.").optional(),
  // Enrichment: estimated transit time (days) and how long this offer is valid.
  // Both optional — empty strings normalize to undefined.
  transitDays: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce
      .number("Transit süresi sayısal olmalı.")
      .int("Transit süresi tam gün olmalı.")
      .positive("Transit süresi pozitif olmalı.")
      .max(365, "Transit süresi çok uzun.")
      .optional()
  ),
  validUntil: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.date("Geçerli bir tarih girin.").optional()
  ),
});
export type BidInput = z.infer<typeof bidInputSchema>;
