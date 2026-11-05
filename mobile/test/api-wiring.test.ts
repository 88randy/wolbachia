import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it, mock } from "node:test";

import { unwrap } from "@wolbachia/api-client";

import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { createMemoryTokenStore } from "./support/token-store.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import { FIXED_DEVICE_ID, makeEnvelope } from "./support/factories.ts";

import { answer } from "./support/scripted-transport.ts";

const BASE_URL = "http://192.168.1.20:8000";
// Generated at run time (docs/engineering-rules.md section 9): no token literal in the repo.
const TEST_TOKEN = randomUUID();

const ME = {
  user: { id: "u1", username: "courier-1", full_name: "Test Courier" },
  organization: null,
  profiles: [],
  permissions: ["field_event.sync"],
  scope: { centers: [], quadrants: [] },
  organizations: [],
  limits: { void_reason_min_length: 10, void_reason_max_length: 1000 },
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function recordingFetch(respond: () => Response) {
  const requests: Request[] = [];
  const fetch = (request: Request): Promise<Response> => {
    requests.push(request);
    return Promise.resolve(respond());
  };
  return { fetch, requests };
}

void describe("mobile API wiring (through @wolbachia/api-client)", () => {
  void it("bounds a hung sync request and classifies an abort as network failure", async () => {
    const controller = new AbortController();
    const timeout = mock.method(AbortSignal, "timeout", () => controller.signal);
    const fetch = (request: Request): Promise<Response> => {
      assert.equal(timeout.mock.calls[0]?.arguments[0], 30_000);
      return new Promise((_resolve, reject) => {
        request.signal.addEventListener(
          "abort",
          () => {
            reject(new Error("Sync request aborted", { cause: request.signal.reason }));
          },
          {
            once: true,
          },
        );
        controller.abort();
      });
    };
    try {
      const transport = createSyncTransport(
        createMobileApiClient({
          baseUrl: BASE_URL,
          tokens: createMemoryTokenStore(),
          fetch,
        }),
      );
      assert.deepEqual(
        await transport({
          device_id: FIXED_DEVICE_ID,
          sent_at: "2026-01-15T12:00:00Z",
          events: [],
        }),
        { ok: false, failure: { kind: "network" } },
      );
      assert.equal(timeout.mock.calls[0]?.arguments[0], 30_000);
    } finally {
      timeout.mock.restore();
    }
  });

  void it("retries malformed 200 answers instead of passing unchecked payloads to the outbox", async () => {
    const valid = answer([]);
    assert.ok(valid.ok);
    for (const body of [
      null,
      {},
      {
        ...valid.response,
        results: [{ id: "one", status: "unknown", code: "accepted", params: {} }],
      },
      { ...valid.response, changes: { ...valid.response.changes, reviews: [{}] } },
      {
        ...valid.response,
        results: [{ id: "one", status: ["accepted"], code: "accepted", params: {} }],
      },
      valid.response,
    ]) {
      const transport = createSyncTransport(
        createMobileApiClient({
          baseUrl: BASE_URL,
          tokens: createMemoryTokenStore(),
          fetch: () => Promise.resolve(jsonResponse(body)),
        }),
      );
      const result = await transport({
        device_id: FIXED_DEVICE_ID,
        sent_at: "2026-01-15T12:00:00Z",
        events: [],
      });
      assert.equal(result.ok, body === valid.response);
      if (!result.ok) assert.equal(result.failure.kind, "http");
    }
  });

  void it("calls GET /api/v1/me/ on the configured server with the bearer token and no cookies", async () => {
    const tokens = createMemoryTokenStore();
    tokens.setAccessToken(TEST_TOKEN);
    const { fetch, requests } = recordingFetch(() => jsonResponse(ME));
    const client = createMobileApiClient({ baseUrl: BASE_URL, tokens, fetch });

    const me = unwrap(await client.GET("/api/v1/me/"));

    const request = requests[0];
    assert.equal(request?.url, `${BASE_URL}/api/v1/me/`);
    assert.equal(request.method, "GET");
    assert.equal(request.headers.get("Authorization"), `Bearer ${TEST_TOKEN}`);
    assert.equal(request.credentials, "omit");
    assert.deepEqual(me.permissions, ["field_event.sync"]);
  });

  void it("sends no Authorization header while nobody is signed in", async () => {
    const { fetch, requests } = recordingFetch(() => jsonResponse(ME));
    const client = createMobileApiClient({
      baseUrl: BASE_URL,
      tokens: createMemoryTokenStore(),
      fetch,
    });

    await client.GET("/api/v1/me/");

    assert.equal(requests[0]?.headers.get("Authorization"), null);
  });

  void it("posts a sync batch to /api/v1/field/sync/ and classifies an error answer with its Retry-After", async () => {
    const tokens = createMemoryTokenStore();
    tokens.setAccessToken(TEST_TOKEN);
    const { fetch, requests } = recordingFetch(() =>
      jsonResponse(
        { code: "sync_in_progress", detail: "busy" },
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "2" } },
      ),
    );
    const transport = createSyncTransport(
      createMobileApiClient({ baseUrl: BASE_URL, tokens, fetch }),
    );
    const event = makeEnvelope();

    const result = await transport({
      device_id: FIXED_DEVICE_ID,
      sent_at: "2026-01-15T12:00:00.000Z",
      events: [event],
    });

    const request = requests[0];
    assert.ok(request);
    assert.equal(request.url, `${BASE_URL}/api/v1/field/sync/`);
    assert.equal(request.method, "POST");
    const body: unknown = await request.json();
    assert.deepEqual(
      (body as { events: { id: string }[] }).events.map((e) => e.id),
      [event.id],
    );
    assert.deepEqual(result, {
      ok: false,
      failure: {
        kind: "http",
        status: 429,
        code: "sync_in_progress",
        fieldCodes: {},
        retryAfterSeconds: 2,
      },
    });
  });

  void it("reports a network failure (fetch rejects) as no answer", async () => {
    const tokens = createMemoryTokenStore();
    const fetch = (): Promise<Response> => Promise.reject(new TypeError("Network request failed"));
    const transport = createSyncTransport(
      createMobileApiClient({ baseUrl: BASE_URL, tokens, fetch }),
    );

    const result = await transport({
      device_id: FIXED_DEVICE_ID,
      sent_at: "2026-01-15T12:00:00.000Z",
      events: [],
    });

    assert.deepEqual(result, { ok: false, failure: { kind: "network" } });
  });
});
