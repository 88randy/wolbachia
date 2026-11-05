import { describe, expect, test } from "vitest";
import { web } from "@wolbachia/tokens";
import { clampSidebarWidth, parseSidebarWidth, stepSidebarWidth } from "./sidebar-size";

describe("sidebar sizing boundary", () => {
  test("clamps drag and keyboard dimensions, including non-finite input", () => {
    expect(clampSidebarWidth(-1)).toBe(web.layout.sidebarMinWidth);
    expect(clampSidebarWidth(9999)).toBe(web.layout.sidebarMaxWidth);
    expect(clampSidebarWidth(Number.NaN)).toBe(web.layout.sidebarWidth);
    expect(stepSidebarWidth(web.layout.sidebarMinWidth, -1)).toBe(web.layout.sidebarMinWidth);
    expect(stepSidebarWidth(web.layout.sidebarWidth, 1)).toBe(
      web.layout.sidebarWidth + web.layout.sidebarResizeStep,
    );
  });
  test("restores numeric preferences and rejects garbage instead of collapsing the layout", () => {
    for (const invalid of [null, "", " ", "NaN", "Infinity", "248px", "{}"]) {
      expect(parseSidebarWidth(invalid)).toBe(web.layout.sidebarWidth);
    }
    expect(parseSidebarWidth("288")).toBe(288);
    expect(parseSidebarWidth("9999")).toBe(web.layout.sidebarMaxWidth);
  });
});
