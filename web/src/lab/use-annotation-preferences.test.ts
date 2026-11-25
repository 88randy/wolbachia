import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useAnnotationPreferences } from "./use-annotation-preferences";

afterEach(() => {
  localStorage.clear();
});

test("persists only annotation preferences and restores them for the same user", () => {
  const first = renderHook(() => useAnnotationPreferences("first-user"));
  act(() => {
    first.result.current.setDefaultBox({ width: 98, height: 42 });
    first.result.current.setColor("success");
    first.result.current.setGridSize(520);
  });
  first.unmount();
  const restored = renderHook(() => useAnnotationPreferences("first-user"));
  expect(restored.result.current.defaultBox).toEqual({ width: 98, height: 42 });
  expect(restored.result.current.color).toBe("success");
  expect(restored.result.current.gridSize).toBe(520);
  expect(
    JSON.parse(localStorage.getItem("aedesvision:annotation-preferences:first-user") ?? "null"),
  ).toEqual({
    version: 1,
    defaultBox: { width: 98, height: 42 },
    color: "success",
    gridSize: 520,
  });
});

test("changes preferences with the user identity without copying another user's settings", () => {
  const { result, rerender } = renderHook(({ userId }) => useAnnotationPreferences(userId), {
    initialProps: { userId: "first-user" },
  });
  act(() => {
    result.current.setGridSize(620);
  });
  rerender({ userId: "second-user" });
  expect(result.current.gridSize).toBe(310);
  act(() => {
    result.current.setGridSize(150);
  });
  rerender({ userId: "first-user" });
  expect(result.current.gridSize).toBe(620);
});

test.each([
  { version: 1, defaultBox: { width: 0, height: 250 }, color: "unknown", gridSize: 10 },
  { version: 1, defaultBox: { width: 1.2, height: "24" }, color: {}, gridSize: 555 },
  { version: 2, defaultBox: { width: 90, height: 90 }, color: "success", gridSize: 1000 },
])("ignores invalid or unsupported stored preferences: %j", (stored) => {
  localStorage.setItem("aedesvision:annotation-preferences:invalid-user", JSON.stringify(stored));
  const { result } = renderHook(() => useAnnotationPreferences("invalid-user"));
  expect(result.current.defaultBox).toEqual({ width: 12, height: 24 });
  expect(result.current.color).toBe("action");
  expect(result.current.gridSize).toBe(310);
});
