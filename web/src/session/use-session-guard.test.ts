import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { makeMe } from "../test/fake-api";
import { begin, commitKnown } from "./session-controller";
import { setSessionState } from "./session-revision";
import { simulateLogin } from "../test/simulate-session";
import { useSessionGuard } from "./use-session-guard";

const OTHER_USER = makeMe({ user: { ...makeMe().user, id: "another-user" } });

describe("useSessionGuard", () => {
  test("regression: a request is stale the instant /me/ names another identity, before React is told", () => {
    const queryClient = new QueryClient();
    commitKnown(queryClient, begin(queryClient, "passive"), {
      me: makeMe(),
      attestation: undefined,
    });
    const { result } = renderHook(() => useSessionGuard());
    const request = result.current();
    expect(request.isStale()).toBe(false);

    // No act(), no flush: the cache swap is all that has happened.
    commitKnown(queryClient, begin(queryClient, "passive"), {
      me: OTHER_USER,
      attestation: undefined,
    });

    expect(request.isStale()).toBe(true);
  });

  test("the same identity again changes nothing; an accepted login does", () => {
    const queryClient = new QueryClient();
    commitKnown(queryClient, begin(queryClient, "passive"), {
      me: makeMe(),
      attestation: undefined,
    });
    const { result } = renderHook(() => useSessionGuard());
    const request = result.current();

    commitKnown(queryClient, begin(queryClient, "passive"), {
      me: makeMe(),
      attestation: undefined,
    });
    expect(request.isStale()).toBe(false);
    simulateLogin();

    expect(request.isStale()).toBe(true);
  });

  test("a request begun while the session is reconciling or unknown is never sent", () => {
    const { result } = renderHook(() => useSessionGuard());
    setSessionState("reconciling");
    const duringReconcile = result.current();
    setSessionState("unknown");
    const duringUnknown = result.current();
    setSessionState("known");
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
