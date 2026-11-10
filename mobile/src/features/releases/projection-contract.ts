import type { Schemas } from "@wolbachia/api-client";
import { readReleaseCapture } from "./capture-contract.ts";
import {
  CourierContractError,
  choice,
  nullable,
  readBoolean,
  readDate,
  readInstant,
  readNonempty,
  readPositiveInteger,
  readRecord,
  readString,
  readUuid,
} from "../ovitrap-lifecycle/contract-readers.ts";

export type ReleasePermit = Schemas["PermitBundle"];
export type ReleaseEligibility = Schemas["EligibilityBundle"];
/** Bootstrap's generated task is a dictionary; retain its actual assignments4 fields. */
export type ReleaseTask = Schemas["Bootstrap"]["assignments"][number] & {
  readonly id: string;
  readonly kind: "task";
  readonly code: string;
  readonly point: string;
  readonly quadrant_id: string;
  readonly courier: string;
  readonly revision: number;
  readonly action: "release";
  readonly date: string;
  readonly is_completed: boolean;
};

export function releaseRows<Result>(value: unknown, read: (row: unknown) => Result): Result[] {
  if (!Array.isArray(value)) throw new CourierContractError();
  return (value as unknown[]).map(read);
}
export function requireDistinctReleaseRows(rows: readonly { readonly id: string }[]): void {
  if (new Set(rows.map(({ id }) => id.toLowerCase())).size !== rows.length)
    throw new CourierContractError();
}
/** Geometry/requirements remain the server's original JSON, never inferred safety facts. */
export function readReleasePermit(value: unknown): ReleasePermit {
  const row = readRecord(value);
  if (!("geometry" in row)) throw new CourierContractError();
  return {
    id: readUuid(row.id),
    code: readNonempty(row.code),
    version: readNonempty(row.version),
    permit_version_id: nullable(readUuid)(row.permit_version_id),
    permit_type_id: nullable(readUuid)(row.permit_type_id),
    revision: readPositiveInteger(row.revision),
    center_id: readUuid(row.center_id),
    quadrant_id: readUuid(row.quadrant_id),
    geometry: row.geometry,
    valid_from: nullable(readInstant)(row.valid_from),
    valid_to: nullable(readInstant)(row.valid_to),
    requirements: readRecord(row.requirements),
    blocked_by: releaseRows(row.blocked_by, readNonempty),
    capture: readReleaseCapture(row.capture),
  };
}
export function readReleaseEligibility(value: unknown): ReleaseEligibility {
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    version: readNonempty(row.version),
    organization_id: readUuid(row.organization_id),
    subject_id: readUuid(row.subject_id),
    action: readNonempty(row.action),
    center_id: readUuid(row.center_id),
    quadrant_id: nullable(readUuid)(row.quadrant_id),
    training_eligible: readBoolean(row.training_eligible),
    requirement_version_id: nullable(readUuid)(row.requirement_version_id),
    training_version_ids: releaseRows(row.training_version_ids, readUuid),
    certification_ids: releaseRows(row.certification_ids, readUuid),
    revocation_ids: releaseRows(row.revocation_ids, readUuid),
    valid_from: nullable(readInstant)(row.valid_from),
    valid_until: nullable(readInstant)(row.valid_until),
    next_change_at: nullable(readInstant)(row.next_change_at),
    blockers: releaseRows(row.blockers, readNonempty),
    assessment_receipt: nullable(readUuid)(row.assessment_receipt),
  };
}
/** A release task carries no permit/version binding; this decoder never creates one. */
export function readReleaseTask(value: unknown): ReleaseTask {
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    kind: choice(["task"])(row.kind),
    code: readNonempty(row.code),
    point: readUuid(row.point),
    quadrant_id: readUuid(row.quadrant_id),
    courier: readUuid(row.courier),
    revision: readPositiveInteger(row.revision),
    action: choice(["release"])(row.action),
    date: readDate(row.date),
    category: nullable(choice(["low", "medium", "high"]))(row.category),
    source: nullable(choice(["official_import", "company_rule"]))(row.source),
    protocol: nullable(readString)(row.protocol),
    target: readPositiveInteger(row.target),
    is_completed: readBoolean(row.is_completed),
  };
}
