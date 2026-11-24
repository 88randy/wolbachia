import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";

export type AnnotationUploadStage = "preparing" | "sending" | "verifying";
export interface AnnotationPhoto {
  file: File;
  clientId: string;
  uploadId: string;
  width: number;
  height: number;
}
interface UploadOptions {
  client: ApiClient;
  file: File;
  clientId: string;
  signal: AbortSignal;
  requireCurrent: () => void;
  onStage: (stage: AnnotationUploadStage) => void;
}
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function isAnnotationPhoto(file: File) {
  return IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES;
}

async function preparePhoto(options: UploadOptions) {
  if (!isAnnotationPhoto(options.file)) throw new Error("Invalid egg annotation photo");
  const bytes = new Uint8Array(await options.file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  options.requireCurrent();
  return {
    bytes,
    sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    ),
  };
}

function verifiedPhoto(options: UploadOptions, status: Schemas["UploadStatus"]) {
  if (status.state !== "verified" || !status.image_width || !status.image_height)
    throw new Error("Unverified egg annotation photo");
  return {
    file: options.file,
    clientId: options.clientId,
    uploadId: status.id,
    width: status.image_width,
    height: status.image_height,
  };
}

async function sendPhoto(
  options: UploadOptions,
  bytes: Uint8Array,
  grant: Schemas["UploadAuthorization"],
) {
  const headers = new Headers(grant.headers);
  const lease = headers.get("Upload-Lease");
  if (
    !lease ||
    !isPut(grant.method) ||
    grant.url !== `/api/v1/field/uploads/${grant.upload_id}/content/` ||
    headers.get("Content-Type") !== options.file.type
  )
    throw new Error("Invalid egg annotation upload authority");
  options.requireCurrent();
  options.onStage("sending");
  unwrap(
    await options.client.PUT("/api/v1/field/uploads/{id}/content/", {
      params: { path: { id: grant.upload_id }, header: { "Upload-Lease": lease } },
      headers: { "Content-Type": options.file.type },
      body: "",
      bodySerializer: () => bytes,
      signal: options.signal,
      redirect: "error",
    }),
  );
}

/** The generated transport keeps same-origin authorization and reports real completed stages. */
export async function uploadAnnotationPhoto(options: UploadOptions): Promise<AnnotationPhoto> {
  options.onStage("preparing");
  const original = await preparePhoto(options);
  const grant = unwrap(
    await options.client.POST("/api/v1/field/uploads/", {
      body: {
        content_type: options.file.type,
        size_bytes: options.file.size,
        sha256: original.sha256,
        client_id: options.clientId,
        purpose: "egg_annotation",
      },
      signal: options.signal,
    }),
  );
  await sendPhoto(options, original.bytes, grant);
  options.requireCurrent();
  options.onStage("verifying");
  const status = unwrap(
    await options.client.POST("/api/v1/field/uploads/{id}/finalize/", {
      params: { path: { id: grant.upload_id } },
      body: {},
      signal: options.signal,
    }),
  );
  options.requireCurrent();
  return verifiedPhoto(options, status);
}

function isPut(value: unknown) {
  return value === "PUT";
}
