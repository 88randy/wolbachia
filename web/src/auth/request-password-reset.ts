import type { ApiClient } from "@wolbachia/api-client";
import { serviceFailureOf } from "../api/service-failure";
import type { ServiceFailure } from "../api/service-failure";

export type ResetRequestOutcome = { ok: true } | { ok: false; failure: ServiceFailure };

/**
 * `POST /auth/password-reset/ {email}`. The API answers `202` with an empty body whether or not
 * the account exists, so a success says nothing about the address. Failures (rate limit, network,
 * server) are values: the screen has something specific to tell the user for each.
 */
export async function requestPasswordReset(
  client: ApiClient,
  email: string,
): Promise<ResetRequestOutcome> {
  try {
    const { response } = await client.POST("/api/v1/auth/password-reset/", { body: { email } });
    return response.ok ? { ok: true } : { ok: false, failure: serviceFailureOf(response.status) };
  } catch (error) {
    console.error("The password reset request failed", error);
    return { ok: false, failure: "network" };
  }
}
