import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";

export interface TransferUpload {
  file: File;
  clientId: string;
  uploadId?: string;
  verifiedAt?: string;
}
interface UploadCall {
  client: ApiClient;
  evidence: TransferUpload;
  signal: AbortSignal;
  requireCurrent: () => void;
  onAuthorized: (id: string) => void;
}
const MAX_BYTES = 10 * 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
export function isTransferEvidenceFile(file: File) {
  return ["image/jpeg", "image/png"].includes(file.type) && file.size > 0 && file.size <= MAX_BYTES;
}
function contentType(file: File): "image/jpeg" | "image/png" {
  if (!isTransferEvidenceFile(file)) throw new Error("Invalid transfer evidence file");
  return file.type === "image/png" ? "image/png" : "image/jpeg";
}
async function originalBytes(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const matches =
    file.type === "image/png"
      ? PNG_SIGNATURE.every((value, index) => bytes[index] === value)
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (bytes.byteLength !== file.size || !matches)
    throw new Error("Invalid transfer image signature");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    bytes,
    sha256: Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
      "",
    ),
  };
}
function verified(answer: Schemas["UploadStatus"], id: string) {
  if (answer.id !== id || answer.state !== "verified" || !answer.verified_at)
    throw new Error("Unverified transfer evidence");
  return { uploadId: id, verifiedAt: answer.verified_at };
}
async function authorize(
  call: UploadCall,
  metadata: { content_type: "image/jpeg" | "image/png"; sha256: string },
) {
  call.requireCurrent();
  if (call.evidence.uploadId)
    return unwrap(
      await call.client.POST("/api/v1/field/uploads/{id}/renew/", {
        params: { path: { id: call.evidence.uploadId } },
        signal: call.signal,
      }),
    );
  return unwrap(
    await call.client.POST("/api/v1/field/uploads/", {
      body: { ...metadata, size_bytes: call.evidence.file.size, client_id: call.evidence.clientId },
      signal: call.signal,
    }),
  );
}
function isPut(value: unknown) {
  return value === "PUT";
}
function grantHeaders(grant: Schemas["UploadAuthorization"], type: string) {
  const headers = new Headers(grant.headers);
  const lease = headers.get("Upload-Lease");
  if (
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(grant.upload_id) ||
    !isPut(grant.method) ||
    grant.url !== `/api/v1/field/uploads/${grant.upload_id}/content/` ||
    !lease ||
    headers.get("Content-Type") !== type
  )
    throw new Error("Invalid transfer upload authority");
  return { lease, type };
}
function renewedVerification(grant: Awaited<ReturnType<typeof authorize>>) {
  if ("state" in grant && grant.state === "verified") {
    if (
      !("id" in grant) ||
      typeof grant.id !== "string" ||
      !("verified_at" in grant) ||
      typeof grant.verified_at !== "string"
    )
      throw new Error("Invalid transfer renewal verification");
    return verified(
      { id: grant.id, state: "verified", verified_at: grant.verified_at },
      grant.upload_id,
    );
  }
}
async function putBytes(
  call: UploadCall,
  id: string,
  content: { bytes: Uint8Array; lease: string; type: string },
) {
  call.requireCurrent();
  const put = await call.client.PUT("/api/v1/field/uploads/{id}/content/", {
    params: { path: { id }, header: { "Upload-Lease": content.lease } },
    headers: { "Content-Type": content.type },
    body: "",
    bodySerializer: () => content.bytes,
    signal: call.signal,
    redirect: "error",
  });
  unwrap(put);
  if (put.response.status !== 204) throw new Error("Unconfirmed transfer evidence receipt");
}
async function finalize(call: UploadCall, id: string) {
  call.requireCurrent();
  const answer = unwrap(
    await call.client.POST("/api/v1/field/uploads/{id}/finalize/", {
      params: { path: { id } },
      body: {},
      signal: call.signal,
    }),
  );
  call.requireCurrent();
  return verified(answer, id);
}
/** Verify unbound bytes; the later custody command binds its own immutable transfer event. */
export async function uploadTransferEvidence(call: UploadCall) {
  call.requireCurrent();
  const type = contentType(call.evidence.file);
  const original = await originalBytes(call.evidence.file);
  const grant = await authorize(call, { content_type: type, sha256: original.sha256 });
  call.requireCurrent();
  if (call.evidence.uploadId && grant.upload_id !== call.evidence.uploadId)
    throw new Error("Changed transfer evidence identity");
  const headers = grantHeaders(grant, type);
  call.onAuthorized(grant.upload_id);
  call.requireCurrent();
  const alreadyVerified = renewedVerification(grant);
  if (alreadyVerified) return alreadyVerified;
  await putBytes(call, grant.upload_id, { ...headers, bytes: original.bytes });
  return finalize(call, grant.upload_id);
}
