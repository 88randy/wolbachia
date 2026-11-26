import { act, renderHook } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LOADING_DELAY_MS } from "../ui/use-delayed-flag";
import { begin } from "./session-controller";
import { setSessionState } from "./session-revision";
import { useDisplaySettled, useVisibleSessionState } from "./use-visible-session-state";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test("a focus check stays invisible for a fast /me/ answer and shows after the delay (#368)", () => {
  const { result } = renderHook(() => useVisibleSessionState());
  act(() => {
    begin(new QueryClient(), "verify");
  });
  expect(result.current).toBe("known");
  act(() => {
    vi.advanceTimersByTime(LOADING_DELAY_MS);
  });
  expect(result.current).toBe("reconciling");
  act(() => {
    setSessionState("known");
  });
  expect(result.current).toBe("known");
});

test("a real change (a leave) is shown at once, never graced (#368)", () => {
  const { result } = renderHook(() => useVisibleSessionState());
  act(() => {
    begin(new QueryClient(), "leave");
  });
  expect(result.current).toBe("reconciling");
});

test("a check that lands on top of a leave stays a leave (#368)", () => {
  const client = new QueryClient();
  const { result } = renderHook(() => useVisibleSessionState());
  act(() => {
    begin(client, "leave");
    begin(client, "verify");
  });
  expect(result.current).toBe("reconciling");
});

test("the display flag keeps a settled screen drawn during a check, not during a leave (#368)", () => {
  const { result } = renderHook(() => useDisplaySettled(false));
  expect(result.current).toBe(false);
  act(() => {
    begin(new QueryClient(), "verify");
  });
  expect(result.current).toBe(true);
  act(() => {
    vi.advanceTimersByTime(LOADING_DELAY_MS);
  });
  expect(result.current).toBe(false);
});
