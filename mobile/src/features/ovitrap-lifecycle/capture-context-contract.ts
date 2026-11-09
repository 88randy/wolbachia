import type { Schemas } from "@wolbachia/api-client";
import type { EvidenceOwner } from "../../attachments/types.ts";
import type { AssignmentAuthority } from "../ovitrap-check/snapshot-authority.ts";
import {
  CourierContractError,
  choice,
  readNonempty,
  readRecord,
  readUuid,
} from "./contract-readers.ts";

const CAPTURE_SCHEMA_VERSION = 1;
const SYNC_PERMISSION = "field_event.sync";
const SCOPE_REVISION_PATTERN = /^[0-9a-f]{64}$/;
/** Captured by the existing authenticated transport/writer BEFORE awaits, never by a DTO. */
export interface CaptureTransportHandle extends AssignmentAuthority {
  readonly owner: EvidenceOwner;
  readonly sessionId: string;
  readonly scopeRevision: string | null;
  readonly isCurrent: () => boolean;
}
interface CaptureInput {
  readonly source: "bootstrap" | "changes" | "no-pull" | "final";
  readonly body: unknown;
  readonly handle: CaptureTransportHandle | null;
}
export type CaptureObservation =
  | {
      readonly state: "observed";
      readonly context: Schemas["CaptureContext"];
      readonly source: "bootstrap" | "changes";
      readonly binding: Omit<CaptureTransportHandle, "isCurrent" | "scopeRevision">;
    }
  | { readonly state: "unavailable"; readonly reason: string }
  | { readonly state: "no-observation" };
function exactKeys(row: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(row).length !== keys.length || !keys.every((key) => key in row))
    throw new CourierContractError();
}
function readDimension(value: unknown): Schemas["ScopeDimension"] {
  const row = readRecord(value);
  exactKeys(row, ["mode", "ids"]);
  const mode = choice(["none", "selected", "all"])(row.mode);
  if (!Array.isArray(row.ids)) throw new CourierContractError();
  const ids = (row.ids as unknown[]).map(readUuid);
  const unique = new Set(ids.map((id) => id.toLowerCase()));
  if ((mode !== "selected" && ids.length > 0) || unique.size !== ids.length)
    throw new CourierContractError();
  return { mode, ids };
}
function readGrant(value: unknown): Schemas["MeScope"] {
  const row = readRecord(value);
  exactKeys(row, ["centers", "quadrants"]);
  return { centers: readDimension(row.centers), quadrants: readDimension(row.quadrants) };
}
function readContext(value: unknown): Schemas["CaptureContext"] {
  const row = readRecord(value);
  if (
    row.schema_version !== CAPTURE_SCHEMA_VERSION ||
    row.permission !== SYNC_PERMISSION ||
    !Array.isArray(row.grants) ||
    !SCOPE_REVISION_PATTERN.test(readNonempty(row.scope_revision))
  )
    throw new CourierContractError();
  return {
    schema_version: CAPTURE_SCHEMA_VERSION,
    permission: SYNC_PERMISSION,
    user_id: readUuid(row.user_id),
    organization_id: readUuid(row.organization_id),
    scope_revision: readNonempty(row.scope_revision),
    grants: (row.grants as unknown[]).map(readGrant),
  };
}
function validateHandle(handle: CaptureTransportHandle): void {
  readNonempty(handle.owner.issuer);
  readUuid(handle.owner.organizationId);
  readUuid(handle.owner.userId);
  readUuid(handle.owner.deviceId);
  readNonempty(handle.sessionId);
  if (!Number.isSafeInteger(handle.revision) || handle.revision < 0)
    throw new CourierContractError();
}
function contextFor(input: CaptureInput, handle: CaptureTransportHandle) {
  validateHandle(handle);
  const body = readRecord(input.body);
  const context = readContext(body.capture_context);
  if (
    context.user_id.toLowerCase() !== handle.owner.userId.toLowerCase() ||
    context.organization_id.toLowerCase() !== handle.owner.organizationId.toLowerCase()
  )
    throw new CourierContractError();
  if (input.source === "bootstrap") {
    readNonempty(body.bundle_version);
    readNonempty(body.schema_version); // The root schema remains opaque.
    readNonempty(body.cursor);
    if (context.scope_revision !== body.scope_revision) throw new CourierContractError();
  } else if (context.scope_revision !== handle.scopeRevision) throw new CourierContractError();
  return context;
}
/** Parsed observation only: full foundations/readiness and durable CAS still belong to DayStore. */
export function readCaptureContext(input: CaptureInput): CaptureObservation {
  if (input.source === "final") return { state: "unavailable", reason: "final_session" };
  const handle = input.handle;
  if (handle === null || !handle.isCurrent())
    return { state: "unavailable", reason: "owner_unproven" };
  if (input.source === "no-pull") return { state: "no-observation" };
  if (input.source === "changes" && handle.scopeRevision === null)
    return { state: "unavailable", reason: "bootstrap_required" };
  try {
    const context = contextFor(input, handle);
    if (!handle.isCurrent()) return { state: "unavailable", reason: "stale_transport" };
    return {
      state: "observed",
      context,
      source: input.source,
      binding: {
        owner: { ...handle.owner },
        sessionId: handle.sessionId,
        revision: handle.revision,
      },
    };
  } catch (error) {
    if (error instanceof CourierContractError)
      return { state: "unavailable", reason: "invalid_context" };
    throw error;
  }
}
