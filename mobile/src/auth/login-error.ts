import { isErrorEnvelope } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";

export interface LoginNotice {
  readonly key: MessageKey;
  readonly minutes?: number;
}

export function loginError(error: unknown, response?: Response): LoginNotice {
  if (response === undefined) return { key: "mobile.login.noSignal" };
  const code = isErrorEnvelope(error) ? error.code : "unknown";
  if (code === "invalid_credentials") return { key: "mobile.login.wrongCredentials" };
  if (code === "device_revoked") return { key: "mobile.login.deviceRevoked" };
  if (response.status === 429) return throttledNotice(response);
  return { key: "mobile.login.genericError" };
}

function throttledNotice(response: Response): LoginNotice {
  const header = response.headers.get("Retry-After");
  const seconds = header === null ? NaN : Number(header);
  return Number.isFinite(seconds) && seconds >= 0
    ? { key: "mobile.login.throttled", minutes: Math.max(1, Math.ceil(seconds / 60)) }
    : { key: "mobile.login.throttledUnknown" };
}
