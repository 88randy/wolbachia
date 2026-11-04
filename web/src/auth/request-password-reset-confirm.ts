import { isErrorEnvelope } from "@wolbachia/api-client";
import type { ApiClient, ErrorEnvelope } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { serviceFailureOf } from "../api/service-failure";
import type { ServiceFailure } from "../api/service-failure";

export interface ResetConfirmation {
  uid: string;
  token: string;
  newPassword: string;
}

export type ResetConfirmOutcome =
  | { ok: true }
  /** `invalid_reset_token`: expired, already used or tampered with. Nothing else is revealed. */
  | { ok: false; reason: "invalidLink" }
  /** `validation_error`: the catalog keys of the password validators that failed. */
  | { ok: false; reason: "weakPassword"; messageKey: MessageKey }
  | { ok: false; reason: "service"; failure: ServiceFailure };

/** Password validator codes of the API (docs/api-conventions.md, "Error codes (#4)"). */
const PASSWORD_CODE_KEYS: Record<string, MessageKey> = {
  password_too_short: "auth.reset.passwordTooShort",
  password_too_common: "auth.reset.passwordTooCommon",
  password_entirely_numeric: "auth.reset.passwordEntirelyNumeric",
  password_too_similar: "auth.reset.passwordTooSimilar",
};

const HTTP_BAD_REQUEST = 400;

/** First known validator code of `fields.new_password`, as a catalog key; else the generic one. */
export function passwordMessageKey(envelope: ErrorEnvelope): MessageKey {
  const codes = envelope.fields?.["new_password"] ?? [];
  const known = codes.map(({ code }) => PASSWORD_CODE_KEYS[code]).find((key) => key !== undefined);
  return known ?? "errors.api.validation";
}

function failureOf(status: number, error: unknown): ResetConfirmOutcome {
  if (status === HTTP_BAD_REQUEST && isErrorEnvelope(error)) {
    if (error.code === "invalid_reset_token") return { ok: false, reason: "invalidLink" };
    if (error.code === "validation_error") {
      return { ok: false, reason: "weakPassword", messageKey: passwordMessageKey(error) };
    }
  }
  return { ok: false, reason: "service", failure: serviceFailureOf(status) };
}

/**
 * `POST /auth/password-reset/confirm/ {uid, token, new_password}`: `204` on success. The link's
 * `uid` and `token` go in the body only (the API resolves the link first, so a bad link never
 * reveals the password rules).
 */
export async function confirmPasswordReset(
  client: ApiClient,
  { uid, token, newPassword }: ResetConfirmation,
): Promise<ResetConfirmOutcome> {
  try {
    const { response, error } = await client.POST("/api/v1/auth/password-reset/confirm/", {
      body: { uid, token, new_password: newPassword },
    });
    return response.ok ? { ok: true } : failureOf(response.status, error);
  } catch (caught) {
    console.error("The password reset confirmation failed", caught);
    return { ok: false, reason: "service", failure: "network" };
  }
}
