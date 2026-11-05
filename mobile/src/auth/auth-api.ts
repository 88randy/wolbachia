import { isErrorEnvelope } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";

import { isSessionEnded, RemoteSessionEnded } from "./session-requests.ts";
import type { TokenPair } from "./credential-store.ts";
import { loginError } from "./login-error.ts";
import type { LoginNotice } from "./login-error.ts";

export type LoginResult =
  | { readonly ok: true; readonly login: Schemas["MobileLoginResponse"] }
  | { readonly ok: false; readonly notice: LoginNotice };

/** All network calls use generated api-client methods and generated contract types. */
export async function loginOnline(
  client: ApiClient,
  body: Schemas["LoginRequest"],
): Promise<LoginResult> {
  try {
    const answer = await client.POST("/api/v1/auth/login/", {
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (answer.data !== undefined && "access" in answer.data) {
      return { ok: true, login: answer.data };
    }
    return { ok: false, notice: loginError(answer.error, answer.response) };
  } catch {
    return { ok: false, notice: loginError(undefined) };
  }
}

export async function refreshOnline(
  client: ApiClient,
  pair: TokenPair,
  deviceId: string,
): Promise<TokenPair> {
  const answer = await client.POST("/api/v1/auth/refresh/", {
    body: { refresh: pair.refresh, device_id: deviceId },
    signal: AbortSignal.timeout(30_000),
  });
  if (answer.data !== undefined) return answer.data;
  const code = isErrorEnvelope(answer.error) ? answer.error.code : "";
  if (isSessionEnded(code) || code === "token_expired") throw new RemoteSessionEnded();
  throw new Error("Refresh could not complete.");
}
