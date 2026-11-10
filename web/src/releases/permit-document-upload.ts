import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { isPermitDocumentType, permitDocumentProblem } from "./permit-document";
import type { PermitDocumentType } from "./permit-document";

interface UploadCall {
  client: ApiClient;
  file: File;
  clientId: string;
  signal: AbortSignal;
}

const SIGNATURES: Record<PermitDocumentType, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
  "image/png": [137, 80, 78, 71, 13, 10, 26, 10],
  "image/jpeg": [255, 216, 255],
};

async function readOriginal(file: File) {
  if (!isPermitDocumentType(file.type) || permitDocumentProblem(file))
    throw new Error("Invalid permit document");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || !SIGNATURES[file.type].every((b, i) => bytes[i] === b))
    throw new Error("Invalid permit document signature");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return { bytes, sha256, type: file.type };
}

type Original = Awaited<ReturnType<typeof readOriginal>>;

async function authorize(call: UploadCall, original: Original) {
  const grant = unwrap(
    await call.client.POST("/api/v1/field/uploads/", {
      body: {
        content_type: original.type,
        sha256: original.sha256,
        size_bytes: call.file.size,
        client_id: call.clientId,
      },
      signal: call.signal,
    }),
  );
  const lease = new Headers(grant.headers).get("Upload-Lease");
  if (!lease) throw new Error("Invalid permit document upload authority");
  return { id: grant.upload_id, lease };
}

async function send(call: UploadCall, original: Original, grant: { id: string; lease: string }) {
  unwrap(
    await call.client.PUT("/api/v1/field/uploads/{id}/content/", {
      params: { path: { id: grant.id }, header: { "Upload-Lease": grant.lease } },
      headers: { "Content-Type": original.type },
      body: "",
      bodySerializer: () => original.bytes,
      signal: call.signal,
      redirect: "error",
    }),
  );
}

/**
 * Authorize, PUT the original bytes and finalize through the existing upload endpoints. Returns the
 * verified upload id, to be sent as `official_document` when the permit version is written.
 */
export async function uploadPermitDocument(call: UploadCall): Promise<string> {
  const original = await readOriginal(call.file);
  const grant = await authorize(call, original);
  await send(call, original, grant);
  const status = unwrap(
    await call.client.POST("/api/v1/field/uploads/{id}/finalize/", {
      params: { path: { id: grant.id } },
      body: {},
      signal: call.signal,
    }),
  );
  if (status.state !== "verified") throw new Error("Unverified permit document");
  return grant.id;
}
