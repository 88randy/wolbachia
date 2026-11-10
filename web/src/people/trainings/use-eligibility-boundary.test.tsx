import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useEligibilityBoundary } from "./use-eligibility-boundary";
afterEach(() => {
  vi.useRealTimers();
});
test("current eligibility is hidden at the server boundary while its authoritative refresh is pending", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
  const refetch = vi.fn(() => new Promise<unknown>(() => undefined));
  const hook = renderHook(
    ({ nextChange }) => useEligibilityBoundary({ nextChange, isFixedInstant: false, refetch }),
    { initialProps: { nextChange: "2026-11-09T12:00:01Z" } },
  );
  expect(hook.result.current).toBe(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(hook.result.current).toBe(true);
  expect(refetch).toHaveBeenCalledTimes(1);
  hook.rerender({ nextChange: "2026-11-09T12:00:02Z" });
  expect(hook.result.current).toBe(false);
});
test("a fixed historical instant never changes qualification when wall-clock validity expires", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
  const refetch = vi.fn(() => Promise.resolve());
  const hook = renderHook(() =>
    useEligibilityBoundary({ nextChange: "2026-11-09T12:00:01Z", isFixedInstant: true, refetch }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(hook.result.current).toBe(false);
  expect(refetch).not.toHaveBeenCalled();
});
