import type { MessageKey } from "@wolbachia/i18n";
import { ApiError } from "@wolbachia/api-client";
import { SERVICE_FAILURE_KEYS, serviceFailureOf } from "../api/service-failure";

const FORBIDDEN = 403;
const NOT_FOUND = 404;

/**
 * Catalog key that says why a list could not load. The API never returns text for people: only
 * its `code` and the HTTP status matter here (docs/api-conventions.md).
 */
export function tableErrorKey(error: unknown): MessageKey {
  if (error instanceof TypeError) return SERVICE_FAILURE_KEYS.network;
  if (!(error instanceof ApiError)) return SERVICE_FAILURE_KEYS.generic;
  if (error.status === FORBIDDEN) return "errors.api.permissionDenied";
  if (error.status === NOT_FOUND) return "errors.api.notFound";
  return SERVICE_FAILURE_KEYS[serviceFailureOf(error.status)];
}
