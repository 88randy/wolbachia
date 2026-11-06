import type { SyncFailure } from "../../src/sync/sync-failure.ts";
import type {
  SyncBatchRequest,
  SyncCallResult,
  SyncResponse,
  SyncTransport,
} from "../../src/sync/sync-transport.ts";

export interface ScriptedTransport {
  readonly transport: SyncTransport;
  readonly requests: SyncBatchRequest[];
}

/** A transport that answers from a script, in order, and records every request it got. */
export function scriptedTransport(answers: readonly SyncCallResult[]): ScriptedTransport {
  const requests: SyncBatchRequest[] = [];
  const pending = [...answers];
  const transport: SyncTransport = (request) => {
    requests.push(request);
    const answer = pending.shift();
    if (answer === undefined) return Promise.reject(new Error("The script has no answer left."));
    return Promise.resolve(answer);
  };
  return { transport, requests };
}

export interface ChangesOverrides {
  readonly cursor?: string | null;
  readonly hasMore?: boolean;
  readonly reviews?: SyncResponse["changes"]["reviews"];
  readonly catalogVersion?: string | null;
  readonly rulesVersion?: string | null;
}

/** A `200` answer. `results` is one entry per event, as the server sends it. */
export function answer(
  results: SyncResponse["results"],
  changes: ChangesOverrides = {},
): SyncCallResult {
  return {
    ok: true,
    response: {
      server_time: "2026-01-15T12:00:02.000Z",
      results,
      changes: {
        cursor: changes.cursor ?? null,
        reviews: changes.reviews ?? [],
        catalog_version: changes.catalogVersion ?? null,
        rules_version: changes.rulesVersion ?? null,
        has_more: changes.hasMore ?? false,
        next_change_at: null,
        assignments: [],
        supplies: [],
        permits: [],
        eligibility: [],
        history: [],
        map_manifests: [],
        quadrants: [],
        sampling_points: [],
        ovitraps: [],
      },
    },
  };
}

export function accepted(id: string): SyncResponse["results"][number] {
  return { id, status: "accepted", code: "accepted", params: {} };
}

export function failure(failed: SyncFailure): SyncCallResult {
  return { ok: false, failure: failed };
}

export function httpFailure(
  status: number,
  code: string,
  extra: Partial<Extract<SyncFailure, { kind: "http" }>> = {},
): SyncCallResult {
  return failure({
    kind: "http",
    status,
    code,
    fieldCodes: {},
    retryAfterSeconds: null,
    ...extra,
  });
}
