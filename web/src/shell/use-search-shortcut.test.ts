import { describe, expect, test } from "vitest";
import { searchShortcutHint } from "./use-search-shortcut";

describe("searchShortcutHint", () => {
  test.each([
    ["MacIntel", "⌘K"],
    ["Win32", "Ctrl K"],
    ["Linux x86_64", "Ctrl K"],
  ])("%s shows %s", (platform, hint) => {
    expect(searchShortcutHint(platform)).toBe(hint);
  });
});
