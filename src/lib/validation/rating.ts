import { z } from "zod";

/** A customer's one-time rating of the supplier (and driver) on a COMPLETED shipment. */
export const ratingInputSchema = z.object({
  score: z.coerce
    .number("Puan sayısal bir değer olmalı.")
    .int("Puan tam sayı olmalı.")
    .min(1, "Puan en az 1 olmalı.")
    .max(5, "Puan en fazla 5 olmalı."),
  comment: z.string().trim().max(500, "Yorum çok uzun.").optional(),
});
export type RatingInput = z.infer<typeof ratingInputSchema>;
