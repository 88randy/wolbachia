import { ApiError } from "@wolbachia/api-client";
import { beforeEach, describe, expect, test } from "vitest";
import { createWebApiClient } from "../api/create-web-api-client";
import { apiError, createFakeApi, makeMe } from "../test/fake-api";
import { fetchMe } from "./me-query";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "./organization-slug";

const ME_PATH = "GET /api/v1/me/";

beforeEach(() => {
  clearOrganizationSlug();
  window.localStorage.clear();
});

function clientFor(api: ReturnType<typeof createFakeApi>) {
  return createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
}

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
