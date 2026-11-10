import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import type { TrainingScope } from "./training-query";
export interface CertificateEvidence {
  file: File;
  clientId: string;
  uploadId?: string;
  verifiedAt?: string;
}
interface UploadCall {
  scope: TrainingScope;
  evidence: CertificateEvidence;
  signal: AbortSignal;
  requireCurrent: () => void;
  onAuthorized: (id: string) => void;
}
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
export function isCertificateImage(file: File) {
  return (
    ["image/jpeg", "image/png"].includes(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES
  );
}
function contentType(file: File): "image/jpeg" | "image/png" {
  if (!isCertificateImage(file)) throw new Error("Invalid certification image");
  return file.type === "image/png" ? "image/png" : "image/jpeg";
}
async function originalImage(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const matches =
    file.type === "image/png"
      ? PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (bytes.byteLength !== file.size || !matches)
    throw new Error("Invalid certification image signature");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    bytes,
    sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    ),
  };
}
async function authorizeImage(
  call: UploadCall,
  metadata: { content_type: "image/jpeg" | "image/png"; sha256: string },
) {
  call.requireCurrent();
  if (call.evidence.uploadId)
    return unwrap(
      await call.scope.client.POST("/api/v1/field/uploads/{id}/renew/", {
        params: { path: { id: call.evidence.uploadId } },
        signal: call.signal,
      }),
    );
  return unwrap(
    await call.scope.client.POST("/api/v1/field/uploads/", {
      body: { ...metadata, size_bytes: call.evidence.file.size, client_id: call.evidence.clientId },
      signal: call.signal,
    }),
  );
}
function verification(answer: Schemas["UploadStatus"], id: string) {
  if (answer.id !== id || answer.state !== "verified" || !answer.verified_at)
    throw new Error("Unverified certification image");
  return { uploadId: id, verifiedAt: answer.verified_at };
}
function existingVerification(grant: Awaited<ReturnType<typeof authorizeImage>>) {
  if (!("state" in grant) || grant.state !== "verified") return;
  if (
    !("id" in grant) ||
    typeof grant.id !== "string" ||
    !("verified_at" in grant) ||
    typeof grant.verified_at !== "string"
  )
    throw new Error("Invalid certification renewal verification");
  return verification(
    { id: grant.id, state: "verified", verified_at: grant.verified_at },
    grant.upload_id,
  );
}
function isPut(method: unknown) {
  return method === "PUT";
}
function validatedGrant(grant: Schemas["UploadAuthorization"], type: string) {
  const headers = new Headers(grant.headers);
  const lease = headers.get("Upload-Lease");
  if (
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(grant.upload_id) ||
    !isPut(grant.method) ||
    grant.url !== `/api/v1/field/uploads/${grant.upload_id}/content/` ||
    !lease ||
    headers.get("Content-Type") !== type
  )
    throw new Error("Invalid certification upload authority");
  return { lease, type };
}
async function putOriginal(
  call: UploadCall,
  id: string,
  content: { bytes: Uint8Array; lease: string; type: string },
) {
  call.requireCurrent();
  const result = await call.scope.client.PUT("/api/v1/field/uploads/{id}/content/", {
    params: { path: { id }, header: { "Upload-Lease": content.lease } },
    headers: { "Content-Type": content.type },
    body: "",
    bodySerializer: () => content.bytes,
    signal: call.signal,
    redirect: "error",
  });
  unwrap(result);
  if (result.response.status !== 204) throw new Error("Unconfirmed certification image receipt");
}
async function finalizeImage(call: UploadCall, id: string) {
  call.requireCurrent();
  const status = unwrap(
    await call.scope.client.POST("/api/v1/field/uploads/{id}/finalize/", {
      params: { path: { id } },
      body: {},
      signal: call.signal,
    }),
  );
  call.requireCurrent();
  return verification(status, id);
}
/** B04 unbound authorize/PUT/finalize precedes the atomic certification attachment command. */
export async function uploadCertificateEvidence(call: UploadCall) {
  call.requireCurrent();
  const type = contentType(call.evidence.file);
  const original = await originalImage(call.evidence.file);
  const grant = await authorizeImage(call, { content_type: type, sha256: original.sha256 });
  call.requireCurrent();
  if (call.evidence.uploadId && call.evidence.uploadId !== grant.upload_id)
    throw new Error("Changed certification upload identity");
  call.onAuthorized(grant.upload_id);
  const existing = existingVerification(grant);
  if (existing) return existing;
  await putOriginal(call, grant.upload_id, {
    ...validatedGrant(grant, type),
    bytes: original.bytes,
  });
  return finalizeImage(call, grant.upload_id);
}
