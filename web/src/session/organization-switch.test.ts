import { beforeEach, describe, expect, test } from "vitest";
import { createWebApiClient } from "../api/create-web-api-client";
import { createAppQueryClient } from "../api/query-client";
import { apiError, createFakeApi, makeMe, makeOrganization } from "../test/fake-api";
import { ME_QUERY_KEY, loadMe } from "./me-query";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "./organization-slug";
import { switchOrganization } from "./organization-switch";
import { begin, commitKnown } from "./session-controller";
import { sessionState } from "./session-revision";

const ME = "GET /api/v1/me/";

function meOf(slug: string) {
  return { ...makeMe(), organization: makeOrganization(slug, slug) };
}

beforeEach(() => {
  clearOrganizationSlug();
  window.localStorage.clear();
});

describe("switchOrganization", () => {
  test("does not reuse a /me/ still in flight for the previous organization", async () => {
    setOrganizationSlug("norte");
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const api = createFakeApi({
      [ME]: (request) => {
        calls += 1;
        if (calls === 1) return pending;
        return Response.json(meOf(request.headers.get("X-Organization") ?? ""));
      },
    });
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
    const queryClient = createAppQueryClient({ retry: false });
    const inFlight = loadMe(queryClient, client).catch(() => undefined);

    const switched = switchOrganization(queryClient, client, "sur");
    release(Response.json(meOf("norte")));
    const me = await switched;
    await inFlight;

    expect(me.organization?.slug).toBe("sur");
    expect(queryClient.getQueryData(ME_QUERY_KEY)).toMatchObject({ organization: { slug: "sur" } });
    expect(api.requests.at(-1)?.headers.get("X-Organization")).toBe("sur");
  });

  test("a late refusal of the previous organization's /me/ does not clear the new slug", async () => {
    setOrganizationSlug("norte");
    let release: (response: Response) => void = () => undefined;
    const late = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const api = createFakeApi({
      [ME]: (request) => {
        calls += 1;
        // The first (north) request is not abortable here: its answer arrives late.
        return calls === 1
          ? late
          : Response.json(meOf(request.headers.get("X-Organization") ?? ""));
      },
    });
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
    const queryClient = createAppQueryClient({ retry: false });
    const inFlight = loadMe(queryClient, client).catch(() => undefined);

    await switchOrganization(queryClient, client, "sur");
    release(apiError(403, "no_active_membership"));
    await inFlight;

    expect(getOrganizationSlug()).toBe("sur");
    // The first request is aborted; a guard that asks again (the revision changed) uses the new slug.
    expect(api.requests[0]?.signal.aborted).toBe(true);
    expect(
      api.requests.slice(1).every((request) => request.headers.get("X-Organization") === "sur"),
    ).toBe(true);
  });

  test("restores the previous slug when the new /me/ fails", async () => {
    setOrganizationSlug("norte");
    const api = createFakeApi({ [ME]: apiError(500, "server_error") });
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });

    await expect(
      switchOrganization(createAppQueryClient({ retry: false }), client, "sur"),
    ).rejects.toThrow();

    expect(getOrganizationSlug()).toBe("norte");
  });

  test("with no previous slug, a failure leaves none", async () => {
    const api = createFakeApi({ [ME]: apiError(500, "server_error") });
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });

    await expect(
      switchOrganization(createAppQueryClient({ retry: false }), client, "sur"),
    ).rejects.toThrow();

    expect(getOrganizationSlug()).toBeUndefined();
  });
});

describe("failure paths never restore anything (#82)", () => {
  test("a switch that fails after another operation took over leaves that operation's slug and state alone", async () => {
    setOrganizationSlug("norte");
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const api = createFakeApi({ [ME]: () => held });
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
    const queryClient = createAppQueryClient({ retry: false });
    const switching = switchOrganization(queryClient, client, "sur").catch(
      (error: unknown) => error,
    );

    // A login for another organization takes over with its own, current token.
    const token = begin(queryClient, "passive");
    commitKnown(queryClient, token, {
      me: meOf("este"),
      attestation: undefined,
      slug: "este",
      bumpEpoch: true, // a login invalidates every token before it
    });
    release(apiError(503, "server_error"));
    await switching;

    expect(getOrganizationSlug()).toBe("este"); // the old code restored "norte" here
    expect(sessionState()).toBe("known");
  });
});
