import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ValidationError } from "@/core/shared/errors";

/**
 * Deliberately outside `public/` — everything under `public/` is served by
 * Next.js with zero auth, and these are business evidence photos (proof of
 * pickup, breakdown reports) for B2B cargo shipments. Reading them back
 * always goes through the authenticated route handler in
 * src/app/api/uploads/[shipmentId]/[filename]/route.ts, never a static path.
 */
const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Matches exactly what saveUploadedPhoto generates below — checked before
// any path.join touches the filesystem, so a crafted filename (e.g. a
// URL-encoded "../../etc/passwd") can never escape UPLOADS_ROOT.
const SAFE_FILENAME_PATTERN = /^[0-9a-f-]+\.(jpg|png|webp)$/i;

/**
 * Writes a driver-uploaded photo to disk, scoped under the shipment it
 * belongs to. Callers must confirm the shipment actually belongs to the
 * uploader BEFORE calling this — it does no ownership check of its own,
 * only format/size validation and the shipmentId shape check below (which
 * guards the filesystem, not authorization).
 */
export async function saveUploadedPhoto(
  file: File,
  shipmentId: string
): Promise<string> {
  if (!UUID_PATTERN.test(shipmentId)) {
    throw new ValidationError("Geçersiz sefer kimliği.");
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    throw new ValidationError(
      "Yalnızca JPEG, PNG veya WEBP formatında fotoğraf yükleyebilirsiniz."
    );
  }
  if (file.size === 0) {
    throw new ValidationError("Yüklenen fotoğraf boş görünüyor.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new ValidationError("Fotoğraf boyutu en fazla 8MB olabilir.");
  }

  const dir = path.join(UPLOADS_ROOT, shipmentId);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return `${shipmentId}/${filename}`;
}

/**
 * Reads a previously-saved photo back off disk. Callers (the uploads route
 * handler) are responsible for authorization — this only validates that
 * `shipmentId`/`filename` are shaped the way this module itself would have
 * produced them, never trusting raw request path segments any further than
 * that before touching the filesystem.
 */
export async function readUploadedPhoto(
  shipmentId: string,
  filename: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!UUID_PATTERN.test(shipmentId) || !SAFE_FILENAME_PATTERN.test(filename)) {
    return null;
  }

  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  const filePath = path.join(UPLOADS_ROOT, shipmentId, filename);

  try {
    const buffer = await readFile(filePath);
    return { buffer, contentType: CONTENT_TYPE_BY_EXT[ext] };
  } catch {
    return null;
  }
}
