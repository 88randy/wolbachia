import { isErrorEnvelope } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { withAuthTimeout } from "../api/auth-timeout";
import { NO_ACTIVE_MEMBERSHIP } from "../api/error-codes";
import { ensureCsrfCookie, fetchCsrfCookie } from "../api/csrf";
import { IDENTITY_HEADER } from "../session/attestation";
import type { Me } from "../session/me";
import { clearOrganizationSlug, getOrganizationSlug } from "../session/organization-slug";
import { classifyLoginFailure } from "./login-failure";
import type { LoginFailure } from "./login-failure";

export interface Credentials {
  username: string;
  password: string;
}

/** A login the server accepted: who, and the attestation of the new session. */
export interface LoginSuccess {
  me: Me;
  attestation: string | undefined;
}

export type LoginOutcome = ({ ok: true } & LoginSuccess) | { ok: false; failure: LoginFailure };

interface RawResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

function postLogin(
  client: ApiClient,
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<RawResult> {
  return client.POST("/api/v1/auth/login/", { body: credentials, signal: withAuthTimeout(signal) });
}

/** A `403 permission_denied` on login means the CSRF cookie or token was missing or stale. */
function isCsrfRejection(result: RawResult): boolean {
  return (
    result.response.status === 403 &&
    isErrorEnvelope(result.error) &&
    result.error.code === "permission_denied"
  );
}

/**
 * A stored organization slug of someone else (the previous session ended without sign-out) is
 * answered with `403 no_active_membership` even though this user may have a membership.
 */
function isStaleSlugRefusal(result: RawResult): boolean {
  return (
    getOrganizationSlug() !== undefined &&
    result.response.status === 403 &&
    isErrorEnvelope(result.error) &&
    result.error.code === NO_ACTIVE_MEMBERSHIP
  );
}

/** The web login answers `{me, server_time}`; the mobile one (with tokens) is not for the web. */
function webMeOf(data: unknown): Me | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if ("access" in data || !("me" in data)) return undefined;
  return data.me as Me;
}

function outcomeOf(result: RawResult): LoginOutcome {
  const me = result.response.ok ? webMeOf(result.data) : undefined;
  if (me !== undefined) {
    return { ok: true, me, attestation: result.response.headers.get(IDENTITY_HEADER) ?? undefined };
  }
  const failure = result.response.ok
    ? ({ kind: "generic" } as const)
    : classifyLoginFailure({
        status: result.response.status,
        body: result.error,
        retryAfter: result.response.headers.get("Retry-After"),
      });
  return { ok: false, failure };
}

async function attemptLogin(
  client: ApiClient,
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<RawResult> {
  await ensureCsrfCookie(client, signal);
  let result = await postLogin(client, credentials, signal);
  if (isCsrfRejection(result)) {
    await fetchCsrfCookie(client, signal);
    result = await postLogin(client, credentials, signal);
  }
  if (isStaleSlugRefusal(result)) {
    clearOrganizationSlug();
    result = await postLogin(client, credentials, signal);
  }
  return result;
}

/**
 * `POST /auth/login/` for the web (no `device_id`), with the CSRF bootstrap: the cookie is
 * fetched when missing, and a CSRF rejection is retried once with a fresh token. The result is a
 * value, not an exception, because every failure has something specific to tell the user.
 */
export async function requestLogin(
  client: ApiClient,
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<LoginOutcome> {
  try {
    return outcomeOf(await attemptLogin(client, credentials, signal));
  } catch (error) {
    console.error("The sign-in request failed", error);
    return { ok: false, failure: { kind: "network" } };
  }
}
