import type { MessageKey } from "@wolbachia/i18n";
import { ApiError } from "@wolbachia/api-client";
import type { ReceptionResult } from "./reception-command";
const RESULT_KEYS: Readonly<Record<string, MessageKey>> = {
  received: "labReception.scan.received",
  no_paddle: "labReception.scan.noPaddle",
  already_received: "labReception.scan.alreadyReceived",
  no_reading: "labReception.scan.noReading",
  lab_missing: "labReception.scan.missing",
  lab_configuration_unavailable: "labReception.scan.configurationPending",
  lab_in_progress: "labReception.scan.inProgress",
  uncertain: "labReception.scan.uncertain",
  invalid: "labReception.scan.invalid",
  not_found: "labReception.scan.unknown",
};
export function receptionResultKey(result: ReceptionResult): MessageKey {
  return RESULT_KEYS[result.code] ?? "labReception.scan.conflict";
}
export function receptionFailure(error: unknown): ReceptionResult {
  if (!(error instanceof ApiError)) return { code: "uncertain" };
  if (error.status >= 500) return { code: "uncertain" };
  return { code: error.status === 404 ? "not_found" : error.code };
}
export function requiresReceptionReview(result: ReceptionResult): boolean {
  return ![
    "received",
    "no_paddle",
    "already_received",
    "no_reading",
    "lab_missing",
    "lab_configuration_unavailable",
    "not_found",
    "invalid",
  ].includes(result.code);
}
