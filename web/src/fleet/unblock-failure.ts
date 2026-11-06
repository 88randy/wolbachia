import { isErrorEnvelope } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { voidFailureKey } from "../void";
import type { VoidFailure, VoidResult } from "../void";

type ConflictCode = "motorcycle_not_blocked" | "motorcycle_inspection_required" | "other";
type UnblockFailure = VoidFailure & { unblockCode: ConflictCode };

/** Preserve only known unblock conflict codes; never show server detail or guess an unknown conflict. */
export function withUnblockFailure(result: VoidResult, error: unknown): VoidResult {
  if (result.ok || "isStale" in result || result.failure.kind !== "blocked") return result;
  const code = isErrorEnvelope(error) ? error.code : undefined;
  const unblockCode =
    code === "motorcycle_not_blocked" || code === "motorcycle_inspection_required" ? code : "other";
  const failure: UnblockFailure = { ...result.failure, unblockCode };
  return { ok: false, failure };
}

export function unblockFailureKey(failure: VoidFailure): MessageKey {
  if (failure.kind !== "blocked") return voidFailureKey(failure);
  const code = "unblockCode" in failure ? failure.unblockCode : undefined;
  if (code === "motorcycle_not_blocked") return "errors.api.motorcycleNotBlocked";
  if (code === "motorcycle_inspection_required") return "errors.api.motorcycleInspectionRequired";
  return "errors.api.generic";
}
