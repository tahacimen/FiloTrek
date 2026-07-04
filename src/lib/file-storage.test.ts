import { rm } from "node:fs/promises";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { readUploadedPhoto, saveUploadedPhoto } from "@/lib/file-storage";
import { ValidationError } from "@/core/shared/errors";

const testShipmentIds: string[] = [];
function testShipmentId() {
  const id = crypto.randomUUID();
  testShipmentIds.push(id);
  return id;
}

function jpegFile(bytes: number, name = "photo.jpg") {
  return new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });
}

describe("file-storage", () => {
  afterAll(async () => {
    await Promise.all(
      testShipmentIds.map((id) =>
        rm(path.join(process.cwd(), "uploads", id), {
          recursive: true,
          force: true,
        })
      )
    );
  });

  it("rejects a disallowed mimetype", async () => {
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    await expect(saveUploadedPhoto(file, testShipmentId())).rejects.toThrow(
      ValidationError
    );
  });

  it("rejects an empty file", async () => {
    await expect(
      saveUploadedPhoto(jpegFile(0), testShipmentId())
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a file over the 8MB cap", async () => {
    await expect(
      saveUploadedPhoto(jpegFile(8 * 1024 * 1024 + 1), testShipmentId())
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a non-UUID-shaped shipmentId (defense in depth against a forged id)", async () => {
    await expect(
      saveUploadedPhoto(jpegFile(100), "../../etc")
    ).rejects.toThrow(ValidationError);
  });

  it("saves a valid photo and returns a shipmentId/filename key", async () => {
    const shipmentId = testShipmentId();
    const key = await saveUploadedPhoto(jpegFile(1024), shipmentId);
    expect(key).toMatch(
      new RegExp(`^${shipmentId}/[0-9a-f-]+\\.jpg$`, "i")
    );
  });

  it("round-trips a saved photo back through readUploadedPhoto", async () => {
    const shipmentId = testShipmentId();
    const key = await saveUploadedPhoto(jpegFile(2048), shipmentId);
    const filename = key.split("/")[1];

    const photo = await readUploadedPhoto(shipmentId, filename);
    expect(photo).not.toBeNull();
    expect(photo?.contentType).toBe("image/jpeg");
    expect(photo?.buffer.byteLength).toBe(2048);
  });

  it("returns null for a well-formed but non-existent file", async () => {
    const photo = await readUploadedPhoto(
      testShipmentId(),
      `${crypto.randomUUID()}.jpg`
    );
    expect(photo).toBeNull();
  });

  it("returns null for a path-traversal-shaped filename without touching the filesystem", async () => {
    const photo = await readUploadedPhoto(
      testShipmentId(),
      "..%2F..%2F..%2Fetc%2Fpasswd"
    );
    expect(photo).toBeNull();
  });

  it("returns null for a non-UUID-shaped shipmentId", async () => {
    const photo = await readUploadedPhoto(
      "not-a-uuid",
      `${crypto.randomUUID()}.jpg`
    );
    expect(photo).toBeNull();
  });
});
