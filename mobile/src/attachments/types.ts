export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const FILE_CHUNK_BYTES = 64 * 1024;
export const UPLOAD_DEADLINE_MS = 30_000;
export const EVIDENCE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface EvidenceOwner {
  readonly issuer: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly deviceId: string;
}
export interface EvidenceFence {
  readonly ownerKey: string;
  readonly sessionId: string;
  readonly generation: number;
}
export interface OwnedEvidence {
  readonly id: string;
  readonly fileRef: string;
  readonly contentType: "image/jpeg" | "image/png";
  readonly sizeBytes: number;
  readonly sha256: string;
}
export interface StoredEvidence {
  readonly file: OwnedEvidence;
  readonly state: "ready" | "authorized" | "received" | "verified";
  readonly attempts: number;
  readonly parentEventId: string | null;
}
export class EvidenceError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "EvidenceError";
  }
}
export function ownerKey(owner: EvidenceOwner): string {
  return JSON.stringify([owner.issuer, owner.organizationId, owner.userId, owner.deviceId]);
}
