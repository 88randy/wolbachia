import { describe, expect, test } from "vitest";
import { makeMe } from "../test/fake-api";
import { canOpenArea, pendingAreaIds } from "./area-access";
import { AREAS } from "./areas";

function area(id: (typeof AREAS)[number]["id"]) {
  const found = AREAS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No area ${id}`);
  return found;
}

describe("canOpenArea", () => {
  test("Home is open to every member, even with no permissions", () => {
    expect(canOpenArea(makeMe({ permissions: [] }), area("home"))).toBe(true);
  });

  test("an area with codes needs at least one of them", () => {
    expect(canOpenArea(makeMe({ permissions: ["device.read"] }), area("settings"))).toBe(true);
    expect(canOpenArea(makeMe({ permissions: ["incident.read"] }), area("settings"))).toBe(false);
    expect(canOpenArea(makeMe({ permissions: [] }), area("settings"))).toBe(false);
  });

  test("a pending area is visible to every member until its issue defines a code", () => {
    expect(canOpenArea(makeMe({ permissions: [] }), area("lab"))).toBe(true);
  });
});

describe("areas still waiting for a permission code", () => {
  // Each issue that builds an area replaces its "pending" with real codes and removes it here.
  test("are exactly these", () => {
    expect(pendingAreaIds()).toEqual([
      "incidents",
      "operations",
      "releases",
      "community",
      "inventory",
      "lab",
      "people",
      "dashboards",
      "regulatory",
    ]);
  });

  test("Home and Settings are never pending", () => {
    expect(pendingAreaIds()).not.toContain("home");
    expect(pendingAreaIds()).not.toContain("settings");
  });
});
