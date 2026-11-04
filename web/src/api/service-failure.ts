import type { MessageKey } from "@wolbachia/i18n";

/** A call that failed for a reason the user cannot fix by editing the form. */
export type ServiceFailure = "network" | "server" | "rateLimited" | "generic";

const HTTP_TOO_MANY_REQUESTS = 429;
const FIRST_SERVER_ERROR = 500;

/** Failure of an error answer that has no meaning of its own for the screen. */
export function serviceFailureOf(status: number): ServiceFailure {
  if (status === HTTP_TOO_MANY_REQUESTS) return "rateLimited";
  return status >= FIRST_SERVER_ERROR ? "server" : "generic";
}

/** Catalog key that explains the failure and what to do next. */
export const SERVICE_FAILURE_KEYS: Record<ServiceFailure, MessageKey> = {
  network: "errors.api.network",
  server: "errors.api.serverError",
  rateLimited: "errors.api.rateLimited",
  generic: "errors.api.generic",
};
