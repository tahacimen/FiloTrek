import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * G3: persistent file storage. Vercel's serverless filesystem is ephemeral, so
 * business-evidence photos (proof of pickup/delivery, the stamped waybill /
 * irsaliye) written to local disk vanish on the next cold start. When the
 * Supabase storage env is configured we upload to a PRIVATE bucket instead;
 * reads still go through the authenticated /api/uploads route, never a public
 * URL. Without the env (local dev / tests) the caller falls back to disk, so
 * nothing breaks before the key is set.
 *
 * Required env (set in Vercel):
 *   SUPABASE_URL                — the project URL (public)
 *   SUPABASE_SERVICE_ROLE_KEY   — service role key (secret, server-only)
 */
export const STORAGE_BUCKET = "shipment-photos";

let cached: SupabaseClient | null | undefined;

export function getStorageClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return cached;
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export function isSupabaseStorageConfigured(): boolean {
  return getStorageClient() !== null;
}
