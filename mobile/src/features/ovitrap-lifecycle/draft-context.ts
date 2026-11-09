import { CourierContractError, readRecord, readUuid } from "./contract-readers.ts";
import type { LifecycleDraft, CurrentLifecycleDraft } from "./types.ts";
function point(value: unknown) {
  const row = readRecord(value);
  readUuid(row.id);
  if (
    typeof row.code !== "string" ||
    typeof row.lat !== "number" ||
    typeof row.lng !== "number" ||
    !Number.isFinite(row.lat) ||
    !Number.isFinite(row.lng) ||
    Math.abs(row.lat) > 90 ||
    Math.abs(row.lng) > 180
  )
    throw new CourierContractError();
  return row;
}
function current(value: Record<string, unknown>): void {
  const source = readRecord(value.source);
  const originalPoint = point(value.point);
  const currentPoint = point(source.point);
  const physical = readRecord(source.physical);
  const epoch = readRecord(source.epoch);
  readUuid(physical.id);
  if (
    originalPoint.id !== currentPoint.id ||
    physical.id !== value.ovitrapId ||
    !Number.isSafeInteger(epoch.revision) ||
    Number(epoch.revision) < 1
  )
    throw new CourierContractError();
  if (physical.kind === "downloaded") {
    if (
      typeof physical.version !== "string" ||
      !Number.isSafeInteger(physical.sequence) ||
      Number(physical.sequence) < 0
    )
      throw new CourierContractError();
  } else if (physical.kind === "owned-local") readUuid(physical.sourceEventId);
  else throw new CourierContractError();
}
/** Decode only. Neither the JSON version nor copied context grants access or ownership. */
export function readLifecycleDraft(value: unknown): LifecycleDraft {
  const row = readRecord(value);
  readUuid(row.eventId);
  readUuid(row.ovitrapId);
  point(row.point);
  if (
    !["replace", "relocate", "remove"].includes(String(row.kind)) ||
    typeof row.deviceTime !== "string" ||
    !Number.isFinite(Date.parse(row.deviceTime)) ||
    !Array.isArray(row.evidence) ||
    !Array.isArray(row.discardedEvidence)
  )
    throw new CourierContractError();
  if (row.schemaVersion === 2) current(row);
  else if (
    row.schemaVersion !== undefined ||
    typeof row.assignment !== "object" ||
    row.assignment === null
  )
    throw new CourierContractError();
  return row as unknown as LifecycleDraft;
}
export function requireCurrentDraft(value: unknown): CurrentLifecycleDraft {
  const draft = readLifecycleDraft(value);
  if (draft.schemaVersion !== 2) throw new CourierContractError();
  return draft;
}
