import { isErrorEnvelope } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";

import { isSessionEnded, RemoteSessionEnded } from "./session-requests.ts";
import type { TokenPair } from "./credential-store.ts";
import { loginError } from "./login-error.ts";
import { isLoginResponse, isTokenPair } from "./auth-response.ts";
import type { LoginNotice } from "./login-error.ts";

export type LoginResult =
  | { readonly ok: true; readonly login: Schemas["MobileLoginResponse"]; readonly origin: string }
  | { readonly ok: false; readonly notice: LoginNotice };

/** All network calls use generated api-client methods and generated contract types. */
export async function loginOnline(
  client: ApiClient,
  body: Schemas["LoginRequest"],
  origin: string,
): Promise<LoginResult> {
  try {
    const answer = await client.POST("/api/v1/auth/login/", {
      body,
      signal: AbortSignal.timeout(30_000),
    });
    if (answer.response.ok && isLoginResponse(answer.data)) {
      return { ok: true, login: answer.data, origin };
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
  if (answer.response.ok && isTokenPair(answer.data))
    return { access: answer.data.access, refresh: answer.data.refresh };
  const code = isErrorEnvelope(answer.error) ? answer.error.code : "";
  if (isSessionEnded(code) || code === "token_expired") throw new RemoteSessionEnded();
  throw new Error("Refresh could not complete.");
}
