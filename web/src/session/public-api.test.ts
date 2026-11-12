import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { removeOrganizationQueries } from "./organization-cache";
import { isPublicApiPath } from "./public-api";

describe("the public API predicate (one rule for attestation and the session cache)", () => {
  test("only the public portal API is public; portal settings and look-alikes are not", () => {
    expect(isPublicApiPath("/api/v1/portal/{org_slug}/")).toBe(true);
    expect(isPublicApiPath("/api/v1/portal/{org_slug}/coverage/")).toBe(true);
    expect(isPublicApiPath("/api/v1/portal-settings/")).toBe(false);
    expect(isPublicApiPath("portal")).toBe(false);
    expect(isPublicApiPath(["/api/v1/portal/"])).toBe(false);
    expect(isPublicApiPath(undefined)).toBe(false);
  });

  test("a session change keeps only queries keyed by a public API path", () => {
    const client = new QueryClient();
    client.setQueryData(["/api/v1/portal/{org_slug}/", "demo"], { public: true });
    // Regression: a private query keyed with a "portal" prefix survived the sign out.
    client.setQueryData(["portal", "demo", "home"], { private: true });
    client.setQueryData(["/api/v1/portal-settings/"], { private: true });
    client.setQueryData(["regulatory", "portal-settings"], { private: true });

    removeOrganizationQueries(client);

    expect(client.getQueryData(["/api/v1/portal/{org_slug}/", "demo"])).toEqual({ public: true });
    expect(client.getQueryData(["portal", "demo", "home"])).toBeUndefined();
    expect(client.getQueryData(["/api/v1/portal-settings/"])).toBeUndefined();
    expect(client.getQueryData(["regulatory", "portal-settings"])).toBeUndefined();
  });
});
