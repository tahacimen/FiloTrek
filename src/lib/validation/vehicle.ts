import { z } from "zod";

import { VehicleBedType, VehicleType } from "@/generated/prisma/client";

export const vehicleInputSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(4, "Geçerli bir plaka girin.")
    .max(15, "Plaka çok uzun.")
    .toUpperCase(),
  vehicleType: z.nativeEnum(VehicleType, "Geçerli bir araç tipi seçin."),
  bedType: z.nativeEnum(VehicleBedType, "Geçerli bir kasa tipi seçin."),
  tonnageCapacity: z.coerce
    .number("Tonaj sayısal bir değer olmalı.")
    .positive("Tonaj pozitif bir değer olmalı.")
    .max(200, "Tonaj değeri çok yüksek."),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;
