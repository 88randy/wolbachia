import type { ApiClient } from "@wolbachia/api-client";
import { ensureCsrfCookie, fetchCsrfCookie } from "../api/csrf";
import { serviceFailureOf } from "../api/service-failure";
import type { ServiceFailure } from "../api/service-failure";

export type LogoutOutcome = { ok: true } | { ok: false; failure: ServiceFailure };

const HTTP_FORBIDDEN = 403;

async function postLogout(client: ApiClient): Promise<Response> {
  const { response } = await client.POST("/api/v1/auth/logout/");
  return response;
}

/**
 * `POST /auth/logout/`: `204`, idempotent (also when the session already expired). A web session
 * is CSRF-protected, so the cookie is ensured first and a 403 is retried once with a fresh one.
 * If the server cannot be reached the session is NOT ended, and the user is told, instead of
 * pretending to be signed out while the session cookie still works.
 */
export async function requestLogout(client: ApiClient): Promise<LogoutOutcome> {
  try {
    await ensureCsrfCookie(client);
    let response = await postLogout(client);
    if (response.status === HTTP_FORBIDDEN) {
      await fetchCsrfCookie(client);
      response = await postLogout(client);
    }
    return response.ok ? { ok: true } : { ok: false, failure: serviceFailureOf(response.status) };
  } catch (error) {
    console.error("The sign-out request failed", error);
    return { ok: false, failure: "network" };
  }
}
