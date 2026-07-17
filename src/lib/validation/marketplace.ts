import { z } from "zod";

/** A supplier's price offer on an open (unassigned) shipment. */
export const bidInputSchema = z.object({
  price: z.coerce
    .number("Fiyat sayısal bir değer olmalı.")
    .positive("Fiyat pozitif bir değer olmalı."),
  message: z.string().trim().max(500, "Mesaj çok uzun.").optional(),
});
export type BidInput = z.infer<typeof bidInputSchema>;
