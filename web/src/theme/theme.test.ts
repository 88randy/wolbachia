import { beforeEach, describe, expect, test } from "vitest";
import { STORAGE_KEYS } from "../storage/safe-storage";
import { applyTheme, getInitialTheme, setTheme } from "./theme";

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

  test("setTheme switches <html data-theme> and is remembered", () => {
    setTheme("dark");

    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(getInitialTheme()).toBe("dark");
  });

  test("applyTheme does not touch the stored preference", () => {
    applyTheme("dark");

    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBeNull();
  });
});
