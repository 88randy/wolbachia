import type { components } from "./generated/schema.ts";

/** Body of every 4xx/5xx response (docs/api-conventions.md). */
export type ErrorEnvelope = components["schemas"]["ErrorEnvelope"];

/** `code` of an `ApiError` whose response did not carry an error envelope (proxy page, timeout). */
export const UNKNOWN_ERROR_CODE = "unknown_error";

/**
 * A failed API call. `code` is what clients translate with `@wolbachia/i18n`; the API never
 * returns user-facing text and `envelope.detail` is for logs only.
 */
export class ApiError extends Error {
  readonly status: number;
  /** `undefined` when the body was not an error envelope. */
  readonly envelope: ErrorEnvelope | undefined;
  readonly code: string;

  constructor(status: number, envelope?: ErrorEnvelope) {
    super(envelope?.detail ?? `Request failed with status ${String(status)}.`);
    this.name = "ApiError";
    this.status = status;
    this.envelope = envelope;
    this.code = envelope?.code ?? UNKNOWN_ERROR_CODE;
  }
}

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate["code"] === "string" && typeof candidate["detail"] === "string";
}

interface FetchResult<Data, Error> {
  data?: Data;
  error?: Error;
  response: Response;
}

/**
 * Returns `data` of a call or throws an `ApiError`. Use it when the caller cannot do anything
 * with the error itself (query functions, form submit handlers); inspect `result.error` instead
 * when a status needs special handling.
 */
export function unwrap<Data, Error>(result: FetchResult<Data, Error>): Data {
  if (result.error !== undefined) {
    const { error, response } = result;
    throw new ApiError(response.status, isErrorEnvelope(error) ? error : undefined);
  }
  return result.data as Data;
}
