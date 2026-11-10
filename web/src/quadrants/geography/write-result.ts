/* eslint-disable complexity -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { ApiError, isErrorEnvelope } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { tableErrorKey } from "../../data-table/table-error";
export interface WriteReply<T> {
  response: Response;
  data?: T;
  error?: unknown;
}
export interface WriteFailure {
  kind: "failed";
  key: MessageKey;
  code: string;
  blocked: string[];
  retryAt: number;
  /** Field error codes (`point_outside_geometry`, `duplicate_code`...). */
  fieldCodes?: string[];
}
export type WriteOutcome<T> = { kind: "saved"; value: T } | { kind: "stale" } | WriteFailure;
const MS_PER_SECOND = 1000;
const FAILURE_KEYS: Record<string, MessageKey> = {
  stale_revision: "geography.error.stale",
  unresolved_points: "geography.error.unresolved",
  geography_in_progress: "geography.error.busy",
  invalid_resolution_set: "geography.error.invalid",
  invalid_geometry: "geography.error.geometry",
};
function retryAt(response: Response): number {
  const header = response.headers.get("Retry-After");
  if (!header) return 0;
  if (/^\d+$/.test(header)) return Date.now() + Number(header) * MS_PER_SECOND;
  const parsed = Date.parse(header);
  return Number.isFinite(parsed) ? parsed : 0;
}
export function failureOf(reply: WriteReply<unknown>): WriteFailure {
  const envelope = isErrorEnvelope(reply.error) ? reply.error : undefined;
  const error = new ApiError(reply.response.status, envelope);
  const isGeometry = envelope?.fields?.["geometry"]?.some(
    (field) => field.code === "invalid_geometry",
  );
  const code = isGeometry ? "invalid_geometry" : error.code;
  const blocked = envelope?.blocked_by?.flatMap((item) => (item.point ? [item.point] : [])) ?? [];
  return {
    kind: "failed",
    code,
    key: FAILURE_KEYS[code] ?? tableErrorKey(error),
    blocked,
    retryAt: retryAt(reply.response),
    fieldCodes: Object.values(envelope?.fields ?? {}).flatMap((items) =>
      items.map((item) => item.code),
    ),
  };
}
