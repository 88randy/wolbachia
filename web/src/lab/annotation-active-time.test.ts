import { afterEach, expect, test, vi } from "vitest";
import { createAnnotationActiveTime } from "./annotation-active-time";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("active time excludes idle intervals and time hidden, resuming on new interaction", () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const timer = createAnnotationActiveTime();
  vi.advanceTimersByTime(10_000);
  expect(timer.read()).toBe(0);
  timer.interact();
  vi.advanceTimersByTime(90_000);
  expect(timer.read()).toBe(60);
  timer.interact();
  vi.advanceTimersByTime(5_000);
  visibility.mockReturnValue("hidden");
  timer.visibility();
  vi.advanceTimersByTime(30_000);
  expect(timer.read()).toBe(65);
  visibility.mockReturnValue("visible");
  timer.visibility();
  vi.advanceTimersByTime(30_000);
  expect(timer.read()).toBe(90);
  timer.interact();
  vi.advanceTimersByTime(5_000);
  expect(timer.read()).toBe(95);
});
