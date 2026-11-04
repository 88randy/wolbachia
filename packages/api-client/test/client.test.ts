import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError, CSRF_HEADER, ORGANIZATION_HEADER, unwrap } from "../src/index.ts";
import {
  bearerAuth,
  BASE_URL,
  clientWith,
  jsonResponse,
  ME,
  recordingFetch,
  sessionAuth,
} from "./helpers.ts";

const ME_PATH = "/api/v1/me/";

// The schema has no unsafe-method endpoint yet; this reaches the middleware with a POST anyway.
type UntypedPost = { POST: (path: string, init?: object) => Promise<unknown> };

function lastRequest(requests: Request[]): Request {
  const request = requests.at(-1);
  assert.ok(request, "no request was sent");
  return request;
}

void describe("requests", () => {
  void it("joins the base URL and the typed path", async () => {
    const { fetch, requests } = recordingFetch();

    await clientWith({ fetch }).GET(ME_PATH);

    assert.equal(lastRequest(requests).url, `${BASE_URL}${ME_PATH}`);
  });

  void it("serializes the typed X-Organization header param", async () => {
    const { fetch, requests } = recordingFetch();

    await clientWith({ fetch }).GET(ME_PATH, {
      params: { header: { "X-Organization": "acme" } },
    });

    assert.equal(lastRequest(requests).headers.get(ORGANIZATION_HEADER), "acme");
  });
});

void describe("session auth", () => {
  void it("uses same-origin credentials and never sends a bearer token", async () => {
    const { fetch, requests } = recordingFetch();

    await clientWith({ fetch, auth: sessionAuth }).GET(ME_PATH);

    const request = lastRequest(requests);
    assert.equal(request.credentials, "same-origin");
    assert.equal(request.headers.get("Authorization"), null);
  });

  void it("sends the CSRF token on unsafe methods", async () => {
    const { fetch, requests } = recordingFetch();
    const client = clientWith({ fetch, auth: sessionAuth }) as unknown as UntypedPost;

    await client.POST(ME_PATH, { body: {} });

    assert.equal(lastRequest(requests).headers.get(CSRF_HEADER), "csrf-token");
  });

  void it("does not send the CSRF token on GET", async () => {
    const { fetch, requests } = recordingFetch();

    await clientWith({ fetch, auth: sessionAuth }).GET(ME_PATH);

    assert.equal(lastRequest(requests).headers.get(CSRF_HEADER), null);
  });

  void it("omits the CSRF header while there is no token yet", async () => {
    const { fetch, requests } = recordingFetch();
    const auth = { kind: "session", getCsrfToken: () => undefined } as const;
    const client = clientWith({ fetch, auth }) as unknown as UntypedPost;

    await client.POST(ME_PATH, { body: {} });

    assert.equal(lastRequest(requests).headers.get(CSRF_HEADER), null);
  });
});

void describe("bearer auth", () => {
  void it("sends the access token and no cookies", async () => {
    const { fetch, requests } = recordingFetch();

    await clientWith({ fetch, auth: bearerAuth }).GET(ME_PATH);

    const request = lastRequest(requests);
    assert.equal(request.headers.get("Authorization"), "Bearer access-token");
    assert.equal(request.credentials, "omit");
  });

  void it("awaits an asynchronous token getter on every request", async () => {
    const { fetch, requests } = recordingFetch();
    let calls = 0;
    const auth = {
      kind: "bearer",
      getAccessToken: () => Promise.resolve(`token-${String(++calls)}`),
    } as const;
    const client = clientWith({ fetch, auth });

    await client.GET(ME_PATH);
    await client.GET(ME_PATH);

    const sent = requests.map((request) => request.headers.get("Authorization"));
    assert.deepEqual(sent, ["Bearer token-1", "Bearer token-2"]);
  });

  void it("sends no Authorization header without a token", async () => {
    const { fetch, requests } = recordingFetch();
    const auth = { kind: "bearer", getAccessToken: () => undefined } as const;

    await clientWith({ fetch, auth }).GET(ME_PATH);

    assert.equal(lastRequest(requests).headers.get("Authorization"), null);
  });
});

void describe("X-Organization", () => {
  void it("is read on every request from getOrganizationSlug", async () => {
    const { fetch, requests } = recordingFetch();
    let slug: string | undefined;
    const client = clientWith({ fetch, getOrganizationSlug: () => slug });

    await client.GET(ME_PATH);
    slug = "acme";
    await client.GET(ME_PATH);
    slug = "";
    await client.GET(ME_PATH);

    const sent = requests.map((request) => request.headers.get(ORGANIZATION_HEADER));
    assert.deepEqual(sent, [null, "acme", null]);
  });

  void it("wins over a different slug passed in the call params", async () => {
    const { fetch, requests } = recordingFetch();
    const client = clientWith({ fetch, getOrganizationSlug: () => "acme" });

    await client.GET(ME_PATH, { params: { header: { "X-Organization": "other" } } });

    assert.equal(lastRequest(requests).headers.get(ORGANIZATION_HEADER), "acme");
  });
});

void describe("unwrap", () => {
  void it("returns the typed data of a successful call", async () => {
    const { fetch } = recordingFetch();

    const me = unwrap(await clientWith({ fetch }).GET(ME_PATH));

    assert.deepEqual(me, ME);
  });

  void it("throws an ApiError carrying the status and the error envelope", async () => {
    const envelope = { code: "no_active_membership", detail: "No active membership." };
    const { fetch } = recordingFetch(() => jsonResponse(envelope, 403));
    const result = await clientWith({ fetch }).GET(ME_PATH);

    assert.throws(
      () => unwrap(result),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        error.code === "no_active_membership" &&
        error.envelope?.detail === "No active membership.",
    );
  });

  void it("keeps the field errors of a validation error", async () => {
    const envelope = {
      code: "validation_error",
      detail: "Validation failed.",
      fields: { name: [{ code: "required", params: {} }] },
    };
    const { fetch } = recordingFetch(() => jsonResponse(envelope, 400));
    const result = await clientWith({ fetch }).GET(ME_PATH);

    assert.throws(
      () => unwrap(result),
      (error: unknown) =>
        error instanceof ApiError && error.envelope?.fields?.["name"]?.[0]?.code === "required",
    );
  });

  void it("maps a body that is not an envelope (proxy error page) to unknown_error", async () => {
    const page = new Response("<html>Bad gateway</html>", { status: 502 });
    const { fetch } = recordingFetch(() => page);
    const result = await clientWith({ fetch }).GET(ME_PATH);

    assert.throws(
      () => unwrap(result),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 502 &&
        error.code === "unknown_error" &&
        error.envelope === undefined,
    );
  });
});
