import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STORAGE_KEYS } from "../storage/safe-storage";
import { stubColorScheme } from "../test/color-scheme";
import { applyTheme, getInitialTheme } from "./theme";

beforeEach(() => {
  applyTheme("light");
  window.localStorage.clear();
  delete document.documentElement.dataset["theme"];
});

afterEach(() => {
  applyTheme("light");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("theme", () => {
  test("uses System by default", () => {
    expect(getInitialTheme()).toBe("system");
  });

  test("ignores a stored value that is not a theme", () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, "sepia");

    expect(getInitialTheme()).toBe("system");
  });

  test("applyTheme sets <html data-theme> without touching the stored preference", () => {
    applyTheme("dark");

    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBeNull();
  });

  test.each(["light", "dark", "system"] as const)("restores the stored %s preference", (theme) => {
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);

    expect(getInitialTheme()).toBe(theme);
  });

  test("System follows color-scheme changes in both directions", () => {
    const scheme = stubColorScheme(false);

    applyTheme("system");
    expect(document.documentElement.dataset["theme"]).toBe("light");
    scheme.setDark(true);
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    scheme.setDark(false);
    expect(document.documentElement.dataset["theme"]).toBe("light");
  });

  test.each(["light", "dark"] as const)("explicit %s overrides later system changes", (theme) => {
    const scheme = stubColorScheme(false);
    applyTheme("system");

    applyTheme(theme);
    scheme.setDark(theme === "light");

    expect(document.documentElement.dataset["theme"]).toBe(theme);
  });

  test("reapplying System stops listening to the previous media query", () => {
    const previous = stubColorScheme(false);
    applyTheme("system");
    stubColorScheme(true);

    applyTheme("system");
    previous.setDark(false);

    expect(document.documentElement.dataset["theme"]).toBe("dark");
  });

  test("System falls back to light without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);

    applyTheme("system");

    expect(document.documentElement.dataset["theme"]).toBe("light");
  });

  test("unavailable storage uses the System default", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(getInitialTheme()).toBe("system");
  });
});
