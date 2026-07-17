import { z } from "zod";

/**
 * z.httpUrl restricts to http/https, rejecting javascript:/mailto:/etc.
 * schemes that would otherwise be stored and later rendered as a clickable
 * navigation link.
 */
export const optionalMapsUrlSchema = z
  .httpUrl("Geçerli bir Google Maps linki girin.")
  .max(2000, "Link çok uzun.")
  .optional();

const shipmentCoreFieldsSchema = z.object({
  originAddress: z
    .string()
    .trim()
    .min(2, "Yükleme noktası girin.")
    .max(200, "Yükleme noktası çok uzun."),
  destinationAddress: z
    .string()
    .trim()
    .min(2, "Teslimat noktası girin.")
    .max(200, "Teslimat noktası çok uzun."),
  distanceKm: z.coerce
    .number("Mesafe sayısal bir değer olmalı.")
    .positive("Mesafe pozitif bir değer olmalı.")
    .max(10000, "Mesafe değeri çok yüksek."),
  tonnage: z.coerce
    .number("Tonaj sayısal bir değer olmalı.")
    .positive("Tonaj pozitif bir değer olmalı.")
    .max(200, "Tonaj değeri çok yüksek."),
  cargoDescription: z
    .string()
    .trim()
    .max(500, "Açıklama çok uzun.")
    .optional(),
});

/**
 * Simple classification only — no temperature-logging-over-time feature.
 * adrClass is free text (the full ADR class/subdivision taxonomy is too
 * granular for a rigid enum here) but required once isDangerousGoods is
 * checked; temperatureMinC/MaxC are optional even under cold chain (a
 * range isn't always known up front) but must be consistent if both given.
 */
const dangerousGoodsFieldsSchema = {
  isDangerousGoods: z.boolean().default(false),
  adrClass: z.string().trim().max(50, "ADR sınıfı çok uzun.").optional(),
  requiresColdChain: z.boolean().default(false),
  temperatureMinC: z.coerce.number("Sıcaklık sayısal bir değer olmalı.").optional(),
  temperatureMaxC: z.coerce.number("Sıcaklık sayısal bir değer olmalı.").optional(),
};

function withDangerousGoodsValidation<T extends z.ZodObject>(schema: T) {
  return schema
    .refine((data) => !data.isDangerousGoods || !!data.adrClass, {
      message: "Tehlikeli madde işaretliyken ADR sınıfı girilmelidir.",
      path: ["adrClass"],
    })
    .refine(
      (data) =>
        !data.requiresColdChain ||
        data.temperatureMinC == null ||
        data.temperatureMaxC == null ||
        data.temperatureMinC <= data.temperatureMaxC,
      {
        message: "Minimum sıcaklık, maksimum sıcaklıktan büyük olamaz.",
        path: ["temperatureMaxC"],
      }
    );
}

/** Supplier dispatcher creating a shipment for a chosen customer. */
export const shipmentInputSchema = withDangerousGoodsValidation(
  shipmentCoreFieldsSchema.extend({
    customerCompanyId: z.uuid("Geçerli bir müşteri firma seçin."),
    ...dangerousGoodsFieldsSchema,
  })
);
export type ShipmentInput = z.infer<typeof shipmentInputSchema>;

/**
 * Customer requesting a vehicle from a chosen supplier ("Araç Çağır").
 * documentTrackingNumber and the two "Kapı Rezervasyonu" map links live only
 * here (not the shared core schema, not the supplier's shipmentInputSchema)
 * — they're the customer's own request-time reference info, entered once
 * and never editable afterward by either side.
 */
export const shipmentRequestInputSchema = withDangerousGoodsValidation(
  shipmentCoreFieldsSchema.extend({
    // Omitted/undefined means "açık pazara aç" — createShipmentRequest leaves
    // supplierCompanyId null and the shipment becomes biddable by any
    // supplier (see dock-reservation-service.ts's sibling pattern of a
    // nullable ownership column already existing before this feature needed
    // it). The existing "send to one specific supplier" flow is otherwise
    // completely unchanged.
    supplierCompanyId: z.uuid("Geçerli bir tedarikçi firma seçin.").optional(),
    documentTrackingNumber: z
      .string()
      .trim()
      .max(100, "Belge takip numarası çok uzun.")
      .optional(),
    originMapsUrl: optionalMapsUrlSchema,
    destinationMapsUrl: optionalMapsUrlSchema,
    ...dangerousGoodsFieldsSchema,
  })
);
export type ShipmentRequestInput = z.infer<typeof shipmentRequestInputSchema>;

/** Customer marking a shipment's cargo as ready ("Yük Hazır, Aracı Gönder"). */
export const loadReadyInputSchema = z.object({
  pickupGateInfo: z
    .string()
    .trim()
    .min(2, "Kapı/rampa bilgisi girin.")
    .max(300, "Kapı/rampa bilgisi çok uzun."),
  pickupMapsUrl: optionalMapsUrlSchema,
});
export type LoadReadyInput = z.infer<typeof loadReadyInputSchema>;

/**
 * Supplier setting/updating the estimated pickup arrival date+time. Comes
 * off an `<input type="datetime-local">`, whose value has no timezone
 * offset — `z.coerce.date()` parses it as local time in whatever timezone
 * `new Date(string)` runs in, which is correct here since both the
 * dispatcher entering it and the customer reading it are in the same
 * business timezone (this app has no per-user timezone setting anywhere).
 */
export const pickupEtaInputSchema = z.object({
  estimatedPickupArrivalAt: z.coerce.date("Geçerli bir tarih ve saat girin."),
});
export type PickupEtaInput = z.infer<typeof pickupEtaInputSchema>;

/** Either side proposing a new price (initial counter-offer or a self-revision). */
export const priceProposalInputSchema = z.object({
  amount: z.coerce
    .number("Fiyat sayısal bir değer olmalı.")
    .positive("Fiyat pozitif bir değer olmalı."),
});
export type PriceProposalInput = z.infer<typeof priceProposalInputSchema>;

/** The receiving side rejecting the current price, with an optional counter. */
export const priceRejectionInputSchema = z.object({
  counterAmount: z.coerce
    .number("Fiyat sayısal bir değer olmalı.")
    .positive("Fiyat pozitif bir değer olmalı.")
    .optional(),
});
export type PriceRejectionInput = z.infer<typeof priceRejectionInputSchema>;
