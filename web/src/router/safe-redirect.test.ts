import { describe, expect, test } from "vitest";
import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  test.each([
    ["/settings", "/settings"],
    ["/incidents?status=open&page=2", "/incidents?status=open&page=2"],
    ["/lab#today", "/lab#today"],
    ["/", "/"],
  ])("keeps the internal path %s", (target, expected) => {
    expect(safeRedirect(target)).toBe(expected);
  });

  test.each([
    ["undefined", undefined],
    ["empty", ""],
    ["protocol-relative", "//evil.example"],
    ["backslash host", "/\\evil.example"],
    ["backslash anywhere", "/ok\\evil"],
    ["absolute URL", "https://evil.example/settings"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["relative path", "settings"],
    ["tab inside the slashes", "/\t/evil.example"],
    ["newline", "/settings\nSet-Cookie: x=1"],
    ["encoded double slash is just a path", "/%2F%2Fevil.example"],
  ])("sends %s to Home unless it is a plain path", (_name, target) => {
    const result = safeRedirect(target);

    expect(result === "/" || result === "/%2F%2Fevil.example").toBe(true);
    expect(result.startsWith("//")).toBe(false);
  });

  test("never sends the user back to the sign-in page (no loop)", () => {
    expect(safeRedirect("/login")).toBe("/");
    expect(safeRedirect("/login?redirect=%2Fsettings")).toBe("/");
  });
});
