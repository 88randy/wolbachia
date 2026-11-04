import { isErrorEnvelope } from "@wolbachia/api-client";
import type { ErrorEnvelope } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { SERVICE_FAILURE_KEYS, serviceFailureOf } from "../api/service-failure";
import type { ServiceFailure } from "../api/service-failure";

/** Why a void request did not succeed, from the codes of docs/api-conventions.md (void contract). */
export type VoidFailure =
  /** `400 validation_error`, `fields.reason`: `void_reason_too_short` with `{min_length}`. */
  | { kind: "reasonTooShort"; minLength: number | undefined }
  /** `400`, `fields.reason`: `void_reason_invalid_characters` (control or bidirectional text). */
  | { kind: "invalidCharacters" }
  /** Another `400`: a blank, missing or too long reason that the form should have stopped. */
  | { kind: "invalid" }
  | { kind: "permissionDenied" }
  | { kind: "notFound" }
  /** `409 already_voided`. */
  | { kind: "alreadyVoided" }
  /** Any other `409`: the record cannot be voided now (`blocked_by`, a version already in force). */
  | { kind: "blocked" }
  | { kind: "service"; failure: ServiceFailure };

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const TOO_SHORT_CODE = "void_reason_too_short";
const INVALID_CHARACTERS_CODE = "void_reason_invalid_characters";

function tooShortOf(envelope: ErrorEnvelope): VoidFailure | undefined {
  const issue = envelope.fields?.["reason"]?.find(({ code }) => code === TOO_SHORT_CODE);
  if (issue === undefined) return undefined;
  const minLength = issue.params["min_length"];
  return {
    kind: "reasonTooShort",
    minLength: typeof minLength === "number" ? minLength : undefined,
  };
}

function hasReasonCode(envelope: ErrorEnvelope, wanted: string): boolean {
  return envelope.fields?.["reason"]?.some(({ code }) => code === wanted) ?? false;
}

function badRequestOf(error: unknown): VoidFailure {
  if (!isErrorEnvelope(error)) return { kind: "invalid" };
  if (hasReasonCode(error, INVALID_CHARACTERS_CODE)) return { kind: "invalidCharacters" };
  return tooShortOf(error) ?? { kind: "invalid" };
}

function conflictOf(error: unknown): VoidFailure {
  const isVoided = isErrorEnvelope(error) && error.code === "already_voided";
  return isVoided ? { kind: "alreadyVoided" } : { kind: "blocked" };
}

/** Reads the error answer of `POST .../void/` (the status and the parsed body, if any). */
export function voidFailureOf(status: number, error: unknown): VoidFailure {
  if (status === HTTP_BAD_REQUEST) return badRequestOf(error);
  if (status === HTTP_FORBIDDEN) return { kind: "permissionDenied" };
  if (status === HTTP_NOT_FOUND) return { kind: "notFound" };
  if (status === HTTP_CONFLICT) return conflictOf(error);
  return { kind: "service", failure: serviceFailureOf(status) };
}

const KEYS: Record<Exclude<VoidFailure["kind"], "service">, MessageKey> = {
  reasonTooShort: "voiding.error.tooShort",
  invalidCharacters: "voiding.error.invalidCharacters",
  invalid: "errors.api.validation",
  permissionDenied: "errors.api.permissionDenied",
  notFound: "errors.api.notFound",
  alreadyVoided: "voiding.error.alreadyVoided",
  blocked: "voiding.error.blocked",
};

/** Catalog key of the message for a failure (the `reasonTooShort` one takes `{min}`). */
export function voidFailureKey(failure: VoidFailure): MessageKey {
  return failure.kind === "service" ? SERVICE_FAILURE_KEYS[failure.failure] : KEYS[failure.kind];
}
