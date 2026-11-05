import { ApiError } from "@wolbachia/api-client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createAppQueryClient } from "../api/query-client";
import { makeMe } from "../test/fake-api";
import { simulateLogin, simulateSignOut } from "../test/simulate-session";
import { ME_QUERY_KEY } from "./me-query";
import {
  endSessionExpiry,
  isSessionExpired,
  reportSessionError,
  subscribeToMembershipLost,
} from "./session-events";

const MEMBERSHIP_LOST = new ApiError(403, { code: "no_active_membership", detail: "Gone." });

afterEach(() => {
  endSessionExpiry();
});

function signedInClient() {
  const client = createAppQueryClient({ retry: false });
  client.setQueryData(ME_QUERY_KEY, makeMe());
  return client;
}

describe("reportSessionError", () => {
  test("a 401 after sign-in marks the session expired, once", () => {
    reportSessionError(new ApiError(401), signedInClient());

    expect(isSessionExpired()).toBe(true);
  });

  test("a 401 with nobody signed in does not", () => {
    reportSessionError(new ApiError(401), createAppQueryClient({ retry: false }));

    expect(isSessionExpired()).toBe(false);
  });

  test("a late 401 after a confirmed sign-out is not an expiry, until the next accepted login", () => {
    simulateSignOut();

    reportSessionError(new ApiError(401), signedInClient());
    expect(isSessionExpired()).toBe(false);

    simulateLogin();
    reportSessionError(new ApiError(401), signedInClient());
    expect(isSessionExpired()).toBe(true);
  });

  test("errors that are not ApiErrors are ignored", () => {
    reportSessionError(new TypeError("Failed to fetch"), signedInClient());

    expect(isSessionExpired()).toBe(false);
  });

  test("a lost membership is reported to the shell", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToMembershipLost(listener);

    reportSessionError(MEMBERSHIP_LOST, signedInClient(), ["incidents"]);
    reportSessionError(MEMBERSHIP_LOST, signedInClient());
    unsubscribe();
    reportSessionError(MEMBERSHIP_LOST, signedInClient(), ["incidents"]);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("a lost membership of /me/ itself is left to the route guards (no refetch loop)", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToMembershipLost(listener);

    reportSessionError(MEMBERSHIP_LOST, signedInClient(), ME_QUERY_KEY);
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });
});
