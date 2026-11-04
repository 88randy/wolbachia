import { isErrorEnvelope } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { NO_ACTIVE_MEMBERSHIP } from "../api/error-codes";
import { retryAfterMinutes } from "../api/retry-after";

/** Why a sign-in did not work, reduced to what the screen has to say. */
export type LoginFailure =
  | { kind: "credentials" }
  | { kind: "locked"; minutes: number | undefined }
  | { kind: "noMembership" }
  | { kind: "network" }
  | { kind: "server" }
  | { kind: "generic" };

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const FIRST_SERVER_ERROR = 500;

interface LoginAnswer {
  status: number;
  /** Parsed error body, when there was one. */
  body: unknown;
  retryAfter: string | null;
}

function errorCodeOf(body: unknown): string | undefined {
  return isErrorEnvelope(body) ? body.code : undefined;
}

/**
 * Maps an error answer of `POST /auth/login/` to a failure. A wrong password, an unknown user and
 * an inactive user are the same `invalid_credentials`, so the screen cannot tell them apart;
 * `429` is both a rate limit and a lockout and carries only `Retry-After`.
 */
export function classifyLoginFailure(answer: LoginAnswer): LoginFailure {
  const code = errorCodeOf(answer.body);
  if (answer.status === HTTP_UNAUTHORIZED && code === "invalid_credentials") {
    return { kind: "credentials" };
  }
  if (answer.status === HTTP_TOO_MANY_REQUESTS) {
    return { kind: "locked", minutes: retryAfterMinutes(answer.retryAfter) };
  }
  if (answer.status === HTTP_FORBIDDEN && code === NO_ACTIVE_MEMBERSHIP) {
    return { kind: "noMembership" };
  }
  if (answer.status >= FIRST_SERVER_ERROR) return { kind: "server" };
  return { kind: "generic" };
}

export interface LoginFailureMessage {
  key: MessageKey;
  /** Next step, shown under the message. */
  hintKey?: MessageKey;
  params?: { minutes: number };
}

/** Catalog keys (and the lockout minutes) for a failure. Never mentions which part was wrong. */
export function loginFailureMessage(failure: LoginFailure): LoginFailureMessage {
  switch (failure.kind) {
    case "credentials":
      return { key: "auth.login.invalidCredentials", hintKey: "auth.login.invalidCredentialsHint" };
    case "locked":
      return failure.minutes === undefined
        ? { key: "auth.lockout.noWait", hintKey: "auth.lockout.hint" }
        : {
            key: "auth.lockout.message",
            params: { minutes: failure.minutes },
            hintKey: "auth.lockout.hint",
          };
    case "noMembership":
      return { key: "auth.login.noMembership" };
    case "network":
      return { key: "errors.api.network" };
    case "server":
      return { key: "errors.api.serverError" };
    case "generic":
      return { key: "errors.api.generic" };
  }
}
