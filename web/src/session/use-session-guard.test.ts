import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { makeMe } from "../test/fake-api";
import { recordIdentity } from "./identity";
import {
  acceptSession,
  beginExternalChange,
  endExternalChange,
  markSessionUnknown,
  clearSessionUnknown,
} from "./session-revision";
import { useSessionGuard } from "./use-session-guard";

const OTHER_USER = makeMe({ user: { ...makeMe().user, id: "another-user" } });

describe("useSessionGuard", () => {
  test("regression: a request is stale the instant /me/ names another identity, before React is told", () => {
    const queryClient = new QueryClient();
    recordIdentity(queryClient, makeMe());
    const { result } = renderHook(() => useSessionGuard());
    const request = result.current();
    expect(request.isStale()).toBe(false);

    // No act(), no flush: the cache swap is all that has happened.
    recordIdentity(queryClient, OTHER_USER);

    expect(request.isStale()).toBe(true);
  });

  test("the same identity again changes nothing; an accepted login does", () => {
    const queryClient = new QueryClient();
    recordIdentity(queryClient, makeMe());
    const { result } = renderHook(() => useSessionGuard());
    const request = result.current();

    recordIdentity(queryClient, makeMe());
    expect(request.isStale()).toBe(false);
    acceptSession();

    expect(request.isStale()).toBe(true);
  });

  test("a request begun while the session is reconciling or unknown is never sent", () => {
    const { result } = renderHook(() => useSessionGuard());
    beginExternalChange();
    const duringReconcile = result.current();
    endExternalChange();
    markSessionUnknown();
    const duringUnknown = result.current();
    clearSessionUnknown();
    const whenKnown = result.current();

    expect(duringReconcile.signal.aborted).toBe(true);
    expect(duringReconcile.isStale()).toBe(true);
    expect(duringUnknown.signal.aborted).toBe(true);
    expect(whenKnown.signal.aborted).toBe(false);
  });

  test("unmounting aborts the request and makes it stale", () => {
    const { result, unmount } = renderHook(() => useSessionGuard());
    const request = result.current();

    unmount();

    expect(request.signal.aborted).toBe(true);
    expect(request.isStale()).toBe(true);
  });
});
