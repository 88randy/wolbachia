import { z } from "zod";

/** Build-time variable that holds the base URL of the backend API. */
export const API_BASE_URL_VARIABLE = "VITE_API_BASE_URL";

/** An absolute http(s) URL, or a same-origin path such as `/api/v1` (not `//host`). */
const apiBaseUrlSchema = z.union([
  z.url({ protocol: /^https?$/ }),
  z.string().regex(/^\/(?!\/)\S*$/),
]);

export interface AppConfig {
  /** Backend API base URL without a trailing slash. */
  readonly apiBaseUrl: string;
}

export type ConfigResult =
  | { readonly ok: true; readonly config: AppConfig }
  | { readonly ok: false; readonly variable: string; readonly problem: string };

function removeTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Reads and validates the runtime configuration from Vite's `import.meta.env`.
 * There is no default on purpose: a wrong API URL must be seen at startup, not as failed calls.
 */
export function readAppConfig(env: Record<string, unknown>): ConfigResult {
  const raw = env[API_BASE_URL_VARIABLE];
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, variable: API_BASE_URL_VARIABLE, problem: "missing or empty" };
  }
  const parsed = apiBaseUrlSchema.safeParse(raw.trim());
  if (!parsed.success) {
    return { ok: false, variable: API_BASE_URL_VARIABLE, problem: "not an http(s) URL or a path" };
  }
  return { ok: true, config: { apiBaseUrl: removeTrailingSlashes(parsed.data) } };
}
