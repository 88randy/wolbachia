import { beforeEach, describe, expect, test } from "vitest";
import { STORAGE_KEYS } from "../storage/safe-storage";
import { applyTheme, getInitialTheme } from "./theme";

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset["theme"];
});

describe("theme", () => {
  test("is light by default", () => {
    expect(getInitialTheme()).toBe("light");
  });

  test("ignores a stored value that is not a theme", () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, "sepia");

    expect(getInitialTheme()).toBe("light");
  });

  test("applyTheme sets <html data-theme> without touching the stored preference", () => {
    applyTheme("dark");

    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBeNull();
  });

  test("a stored dark theme is the initial theme", () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, "dark");

    expect(getInitialTheme()).toBe("dark");
  });
});
