import { isErrorEnvelope, UNKNOWN_ERROR_CODE } from "@wolbachia/api-client";
import type { ApiClient, ErrorEnvelope, Schemas } from "@wolbachia/api-client";

import { isSyncResponse } from "./sync-response.ts";

import type { SyncFailure } from "./sync-failure.ts";

/** [ASSUMPTION] Bound each request to 30 s until the field test (#13). */
export const SYNC_REQUEST_TIMEOUT_MS = 30_000;

export type SyncBatchRequest = Schemas["SyncBatchRequest"];
export type SyncResponse = Schemas["SyncResponse"];

export type SyncCallResult =
  | { readonly ok: true; readonly response: SyncResponse }
  | { readonly ok: false; readonly failure: SyncFailure };

/** Sends one batch and returns either the answer or a classified failure. Never throws. */
export type SyncTransport = (request: SyncBatchRequest) => Promise<SyncCallResult>;

function fieldCodesOf(envelope: ErrorEnvelope | undefined): Record<string, readonly string[]> {
  const entries = Object.entries(envelope?.fields ?? {});
  return Object.fromEntries(entries.map(([name, errors]) => [name, errors.map((e) => e.code)]));
}

function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/** `POST /api/v1/field/sync/` through the api-client. */
export function createSyncTransport(client: ApiClient): SyncTransport {
  return async (request) => {
    try {
      const result = await client.POST("/api/v1/field/sync/", {
        body: request,
        signal: AbortSignal.timeout(SYNC_REQUEST_TIMEOUT_MS),
      });
      if (result.response.ok && isSyncResponse(result.data)) {
        return { ok: true, response: result.data };
      }
      const envelope = isErrorEnvelope(result.error) ? result.error : undefined;
      return {
        ok: false,
        failure: {
          kind: "http",
          status: result.response.status,
          code: result.response.ok
            ? "invalid_sync_response"
            : (envelope?.code ?? UNKNOWN_ERROR_CODE),
          fieldCodes: fieldCodesOf(envelope),
          retryAfterSeconds: parseRetryAfter(result.response.headers.get("Retry-After")),
        },
      };
    } catch {
      // `fetch` rejects when there is no answer (offline, DNS, timeout): the outbox keeps the events.
      return { ok: false, failure: { kind: "network" } };
    }
  };
}
