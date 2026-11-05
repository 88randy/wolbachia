import { unwrap } from "@wolbachia/api-client";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { fakePassword } from "../test/fake-credentials";
import { clearOrganizationSlug, setOrganizationSlug } from "../session/organization-slug";
import { ApiClientProvider, useApiClient } from "./ApiClientProvider";
import { apiOriginOf, createWebApiClient, readCookie } from "./create-web-api-client";

const PAGE_ORIGIN = "http://localhost:3000";

function recordingFetch(body: unknown) {
  const requests: Request[] = [];
  const fakeFetch = (request: Request): Promise<Response> => {
    requests.push(request);
    return Promise.resolve(Response.json(body));
  };
  return { fakeFetch, requests };
}

afterEach(() => {
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

describe("apiOriginOf", () => {
  test.each([
    ["/api/v1", PAGE_ORIGIN],
    ["/api/v1/", PAGE_ORIGIN],
    ["https://api.example.com/api/v1", "https://api.example.com"],
    ["https://example.com/backend/api/v1", "https://example.com/backend"],
    ["https://api.example.com", "https://api.example.com"],
  ])("%s -> %s", (apiBaseUrl, origin) => {
    expect(apiOriginOf(apiBaseUrl, PAGE_ORIGIN)).toBe(origin);
  });
});

describe("readCookie", () => {
  test("finds one cookie among several and decodes it", () => {
    expect(readCookie("csrftoken", "a=1; csrftoken=x%20y; b=2")).toBe("x y");
  });

  test("returns undefined when absent (and does not match a longer name)", () => {
    expect(readCookie("csrftoken", "xcsrftoken=1")).toBeUndefined();
  });
});

describe("createWebApiClient", () => {
  test("GET /api/v1/me/ goes through the client with the configured base URL", async () => {
    const me = { id: "u1" };
    const { fakeFetch, requests } = recordingFetch(me);
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fakeFetch });

    const result = unwrap(await client.GET("/api/v1/me/"));

    expect(result).toEqual(me);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`${window.location.origin}/api/v1/me/`);
    expect(requests[0]?.credentials).toBe("same-origin");
  });

  test("uses the origin of an absolute API URL", async () => {
    const { fakeFetch, requests } = recordingFetch({});
    const client = createWebApiClient(
      { apiBaseUrl: "https://api.example.com/api/v1" },
      { fetch: fakeFetch },
    );

    await client.GET("/api/v1/me/");

    expect(requests[0]?.url).toBe("https://api.example.com/api/v1/me/");
  });

  test("does not send the CSRF header on GET", async () => {
    document.cookie = "csrftoken=secret; path=/";
    const { fakeFetch, requests } = recordingFetch({});
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fakeFetch });

    await client.GET("/api/v1/me/");

    expect(requests[0]?.headers.has("X-CSRFToken")).toBe(false);
  });

  test("sends the CSRF cookie value on unsafe methods", async () => {
    document.cookie = "csrftoken=secret; path=/";
    const { fakeFetch, requests } = recordingFetch({});
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fakeFetch });

    // The schema has no unsafe endpoint yet; the middleware does not care which path it is.
    await (client as unknown as { POST: (path: string) => Promise<unknown> })
      .POST("/api/v1/x/")
      .catch(() => undefined); // an unattested answer is refused; only the request matters here

    expect(requests[0]?.headers.get("X-CSRFToken")).toBe("secret");
  });
});

describe("organization header", () => {
  beforeEach(() => {
    clearOrganizationSlug();
    window.localStorage.clear();
  });

  test("is not sent while no organization was chosen", async () => {
    const { fakeFetch, requests } = recordingFetch({});
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fakeFetch });

    await client.GET("/api/v1/me/");

    expect(requests[0]?.headers.has("X-Organization")).toBe(false);
  });

  test("carries the chosen slug, and only in the header (never in the URL or the body)", async () => {
    setOrganizationSlug("norte");
    const { fakeFetch, requests } = recordingFetch({});
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fakeFetch });

    await client.GET("/api/v1/me/");
    await client.POST("/api/v1/auth/login/", {
      body: { username: "ana", password: fakePassword() },
    });

    const [get, post] = requests;
    expect(get?.headers.get("X-Organization")).toBe("norte");
    expect(post?.headers.get("X-Organization")).toBe("norte");
    expect(get?.url).not.toContain("norte");
    expect(post?.url).not.toContain("norte");
    expect(await post?.text()).not.toContain("norte");
  });

  test("never sends an organization id", async () => {
    setOrganizationSlug("norte");
    const { fakeFetch, requests } = recordingFetch({});
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fakeFetch });

    await client.GET("/api/v1/me/");

    const names = [...(requests[0]?.headers.keys() ?? [])];
    expect(names.filter((name) => name.includes("organization"))).toEqual(["x-organization"]);
  });
});

describe("ApiClientProvider", () => {
  function Probe() {
    useApiClient();
    return <p>has client</p>;
  }

  test("gives the client to descendants", () => {
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" });

    render(
      <ApiClientProvider client={client}>
        <Probe />
      </ApiClientProvider>,
    );

    expect(screen.getByText("has client")).toBeDefined();
  });
});
