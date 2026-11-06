import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { web } from "@wolbachia/tokens";
import { STORAGE_KEYS } from "../storage/safe-storage";
import { useResizableSidebar } from "./use-resizable-sidebar";
afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

test("resizing persists the desktop choice and compact appearance never overwrites it", () => {
  window.localStorage.setItem(STORAGE_KEYS.sidebarWidth, "288");
  window.localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, "false");
  const { result, rerender } = renderHook(({ compact }) => useResizableSidebar(compact), {
    initialProps: { compact: false },
  });
  expect(result.current.width).toBe(288);
  act(() => {
    result.current.resize(320);
  });
  expect(window.localStorage.getItem(STORAGE_KEYS.sidebarWidth)).toBe("320");
  rerender({ compact: true });
  expect(result.current.collapsed).toBe(true);
  expect(window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe("false");
  rerender({ compact: false });
  expect(result.current.collapsed).toBe(false);
  expect(result.current.width).toBe(320);
  act(() => {
    result.current.toggle();
  });
  expect(window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe("true");
});

test("corrupt or blocked storage uses defaults and never prevents resize", () => {
  window.localStorage.setItem(STORAGE_KEYS.sidebarWidth, "broken");
  const { result } = renderHook(() => useResizableSidebar(false));
  expect(result.current.width).toBe(web.layout.sidebarWidth);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  act(() => {
    result.current.resize(280);
  });
  expect(result.current.width).toBe(280);
  expect(result.current.collapsed).toBe(false);
});
