import { ApiError } from "@wolbachia/api-client";
import { CancelledError } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createWebApiClient } from "../api/create-web-api-client";
import { apiError, createFakeApi, makeMe } from "../test/fake-api";
import { createAppQueryClient } from "../api/query-client";
import { fetchMeCommitted, ME_QUERY_KEY, meQueryOptions } from "./me-query";
import { reconcileSession } from "./session-reconcile";
import { begin } from "./session-controller";
import type { Token } from "./session-controller";
import { bumpEpoch, isSignedOutSession, sessionState } from "./session-revision";
import { simulateSignOut } from "../test/simulate-session";
import { endSessionExpiry, isSessionExpired, reportSessionError } from "./session-events";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "./organization-slug";

const ME_PATH = "GET /api/v1/me/";

beforeEach(() => {
  endSessionExpiry();
  clearOrganizationSlug();
  window.localStorage.clear();
});

/** `/me/` as a candidate of an operation that began now (or with `token`), on a fresh cache. */
function fetchMe(client: ReturnType<typeof clientFor>, token?: Token) {
  const queryClient = createAppQueryClient({ retry: false });
  return fetchMeCommitted({ client, queryClient }, token === undefined ? {} : { token });
}

function clientFor(api: ReturnType<typeof createFakeApi>) {
  return createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
}

describe("fetchMe and the signed-out state", () => {
  test("a /me/ that started after a sign-out leaves the signed-out state; a real 401 then counts", async () => {
    simulateSignOut();
    const api = createFakeApi({ [ME_PATH]: Response.json(makeMe()) });

    await fetchMe(clientFor(api));
    const queryClient = createAppQueryClient({ retry: false });
    queryClient.setQueryData(ME_QUERY_KEY, makeMe());
    reportSessionError(new ApiError(401), queryClient);

    expect(isSignedOutSession()).toBe(false);
    expect(isSessionExpired()).toBe(true);
  });

  test("a /me/ that started BEFORE the sign-out does not clear it when it answers after", async () => {
    let release: (response: Response) => void = () => undefined;
    const late = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const api = createFakeApi({ [ME_PATH]: () => late });
    const pending = fetchMe(clientFor(api));
    await vi.waitFor(() => {
      expect(api.requests).toHaveLength(1);
    });

    simulateSignOut();
    release(Response.json(makeMe()));
    // The answer belongs to a revision that is gone: it is discarded, never stored (#82).
    await expect(pending).rejects.toBeInstanceOf(CancelledError);

    expect(isSignedOutSession()).toBe(true);
  });

  test("/me/ is accepted only for the revision that asked for it: a change before it answers discards it", async () => {
    let release: (response: Response) => void = () => undefined;
    const late = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const api = createFakeApi({ [ME_PATH]: () => late });
    const asked = fetchMe(clientFor(api), begin(createAppQueryClient(), "passive"));
    await vi.waitFor(() => {
      expect(api.requests).toHaveLength(1);
    });

    bumpEpoch();
    release(Response.json(makeMe()));

    await expect(asked).rejects.toBeInstanceOf(CancelledError);
  });
});

describe("fetchMe", () => {
  test("returns the user of /me/", async () => {
    const me = makeMe();
    const api = createFakeApi({ [ME_PATH]: Response.json(me) });

    expect(await fetchMe(clientFor(api))).toEqual(me);
  });

  test("a 401 is an ApiError that says nobody is signed in", async () => {
    const api = createFakeApi({ [ME_PATH]: apiError(401, "not_authenticated") });

    const failure = await fetchMe(clientFor(api)).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(401);
  });

  test("a stale stored slug is forgotten and /me/ is retried once without the header", async () => {
    setOrganizationSlug("gone");
    const me = makeMe({ organization: null, profiles: [], permissions: [] });
    const api = createFakeApi({
      [ME_PATH]: (request) =>
        request.headers.has("X-Organization")
          ? apiError(403, "no_active_membership")
          : Response.json(me),
    });

    const result = await fetchMe(clientFor(api));

    expect(result).toEqual(me);
    expect(api.requests.map((request) => request.headers.get("X-Organization"))).toEqual([
      "gone",
      null,
    ]);
    expect(getOrganizationSlug()).toBeUndefined();
  });

  test("no_active_membership without a stored slug is not retried", async () => {
    const api = createFakeApi({ [ME_PATH]: apiError(403, "no_active_membership") });

    await expect(fetchMe(clientFor(api))).rejects.toBeInstanceOf(ApiError);

    expect(api.requests).toHaveLength(1);
  });

  test("other errors keep the stored slug", async () => {
    setOrganizationSlug("norte");
    const api = createFakeApi({ [ME_PATH]: apiError(500, "server_error") });

    await expect(fetchMe(clientFor(api))).rejects.toBeInstanceOf(ApiError);

    expect(getOrganizationSlug()).toBe("norte");
  });
});

describe("a verify next to a pending passive read (#82)", () => {
  test("the verify runs its own /me/ request and ends known, never stuck reconciling", async () => {
    let calls = 0;
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const api = createFakeApi({
      [ME_PATH]: () => (++calls === 1 ? held : Response.json(makeMe())),
    });
    const client = clientFor(api);
    const queryClient = createAppQueryClient({ retry: false });
    const passive = queryClient.fetchQuery(meQueryOptions(client)).catch((error: unknown) => error);
    await vi.waitFor(() => {
      expect(api.requests).toHaveLength(1);
    });

    const verifying = reconcileSession(queryClient, client, "verify"); // focus
    release(Response.json(makeMe()));
    await passive;

    expect(await verifying).toBe(true);
    expect(sessionState()).toBe("known");
    expect(api.requests.length).toBeGreaterThanOrEqual(2);
  });
});
