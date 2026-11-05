import { ApiError, isErrorEnvelope } from "@wolbachia/api-client";
import type { ErrorEnvelope } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import type { QueryClient } from "@tanstack/react-query";
import { SERVICE_FAILURE_KEYS, serviceFailureOf } from "../api/service-failure";
import type { ServiceFailure } from "../api/service-failure";
import { reportSessionError } from "../session/session-events";
import { rangeKeyOf } from "./version-schema";

/** Fields of the form the API can refuse, by the names the form uses. */
export type VersionField = "value" | "effectiveFrom" | "reason";

/** Limits the server reported with `out_of_range`; they win over the ones the page loaded. */
export interface ServerBounds {
  min: number | null;
  max: number | null;
}

export interface FieldIssue {
  key: MessageKey;
  bounds?: ServerBounds;
}

export type VersionOutcome =
  | { ok: true }
  /** `400 validation_error`: what to show under each field. */
  | { ok: false; reason: "fields"; issues: Partial<Record<VersionField, FieldIssue>> }
  | { ok: false; reason: "permissionDenied" | "notFound" }
  /** The answer belongs to another session or the page left: nothing may be done with it. */
  | { ok: false; reason: "stale" }
  | { ok: false; reason: "service"; failure: ServiceFailure };

/** Field of the API (`fields.<name>`) to the field of the form. */
const FIELD_NAMES: Readonly<Record<string, VersionField>> = {
  value: "value",
  effective_from: "effectiveFrom",
  reason: "reason",
};

/** Codes of `POST .../versions/` (docs/api-conventions.md, "Rule parameters"). */
const CODE_KEYS: Readonly<Record<string, MessageKey>> = {
  not_an_integer: "rules.error.notInteger",
  effective_from_in_past: "rules.error.dateInPast",
  effective_from_too_far: "rules.error.dateTooFar",
  duplicate_effective_date: "rules.error.dateTaken",
};

/** What a field says when the code is not one of the above (a missing or malformed value). */
const FALLBACK_KEYS: Readonly<Record<VersionField, MessageKey>> = {
  value: "rules.error.valueInvalid",
  effectiveFrom: "rules.error.dateRequired",
  reason: "rules.error.reasonRequired",
};

function boundOf(params: Record<string, unknown>, name: "min" | "max"): number | null {
  const bound = params[name];
  return typeof bound === "number" ? bound : null;
}

function issueOf(field: VersionField, code: string, params: Record<string, unknown>): FieldIssue {
  if (code === "out_of_range") {
    const bounds = { min: boundOf(params, "min"), max: boundOf(params, "max") };
    return { key: rangeKeyOf(bounds.min, bounds.max), bounds };
  }
  if (code === "max_length") return { key: "rules.error.reasonTooLong" };
  return { key: CODE_KEYS[code] ?? FALLBACK_KEYS[field] };
}

/** The first error of each field the form has. Fields it does not have are left out. */
export function fieldIssuesOf(envelope: ErrorEnvelope): Partial<Record<VersionField, FieldIssue>> {
  const issues: Partial<Record<VersionField, FieldIssue>> = {};
  for (const [name, errors] of Object.entries(envelope.fields ?? {})) {
    const field = FIELD_NAMES[name];
    const first = errors[0];
    if (field !== undefined && first !== undefined)
      issues[field] = issueOf(field, first.code, first.params);
  }
  return issues;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

function failureOf(status: number, error: unknown): VersionOutcome {
  if (status === HTTP_BAD_REQUEST && isErrorEnvelope(error)) {
    const issues = fieldIssuesOf(error);
    if (Object.keys(issues).length > 0) return { ok: false, reason: "fields", issues };
  }
  if (status === HTTP_FORBIDDEN) return { ok: false, reason: "permissionDenied" };
  if (status === HTTP_NOT_FOUND) return { ok: false, reason: "notFound" };
  return { ok: false, reason: "service", failure: serviceFailureOf(status) };
}

const STALE: VersionOutcome = { ok: false, reason: "stale" };

interface Answer {
  response: Response;
  error?: unknown;
}

/**
 * Runs the `POST /rule-parameters/{key}/versions/` call of the typed client and reads its answer:
 * `createVersion(queryClient, () => client.POST("/api/v1/rule-parameters/{parameter_key}/versions/", ...))`.
 * A failed answer is first reported to the session (an expired session or a lost membership still
 * open the re-authentication dialog), then read as field errors, a refusal or a service failure.
 * A network failure becomes a `service` failure instead of an exception.
 */
export async function createVersion(
  queryClient: QueryClient,
  call: () => Promise<Answer>,
  isStale: () => boolean,
): Promise<VersionOutcome> {
  try {
    const { response, error } = await call();
    if (isStale()) return STALE;
    if (response.ok) return { ok: true };
    const envelope = isErrorEnvelope(error) ? error : undefined;
    reportSessionError(new ApiError(response.status, envelope), queryClient);
    return failureOf(response.status, error);
  } catch (caught) {
    if (isStale()) return STALE;
    console.error("The new rule parameter version request failed", caught);
    return { ok: false, reason: "service", failure: "network" };
  }
}

/** Catalog key for an outcome that is not about a field (shown in the form's alert). */
export function outcomeKey(
  outcome: Exclude<VersionOutcome, { ok: true } | { reason: "stale" }>,
): MessageKey {
  if (outcome.reason === "service") return SERVICE_FAILURE_KEYS[outcome.failure];
  if (outcome.reason === "fields") return "errors.api.validation";
  return outcome.reason === "notFound" ? "errors.api.notFound" : "errors.api.permissionDenied";
}
