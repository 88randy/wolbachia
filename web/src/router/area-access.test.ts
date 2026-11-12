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
  test.each(["shift.read", "review_item.read", "relocation.read"])(
    "operations navigation includes a member with only %s",
    (permission) => {
      expect(canOpenArea(makeMe({ permissions: [permission] }), area("operations"))).toBe(true);
    },
  );

  test("Home is open to every member, even with no permissions", () => {
    expect(canOpenArea(makeMe({ permissions: [] }), area("home"))).toBe(true);
  });

  test("an area with codes needs at least one of them", () => {
    expect(canOpenArea(makeMe({ permissions: ["device.read"] }), area("settings"))).toBe(true);
    expect(canOpenArea(makeMe({ permissions: ["incident.read"] }), area("settings"))).toBe(false);
    expect(canOpenArea(makeMe({ permissions: [] }), area("settings"))).toBe(false);
  });

  test("a pending area is visible to every member until its issue defines a code", () => {
    expect(canOpenArea(makeMe({ permissions: [] }), { requiredPermissions: "pending" })).toBe(true);
  });

  test("an area that already has codes is closed to a member without any of them", () => {
    expect(canOpenArea(makeMe({ permissions: [] }), area("regulatory"))).toBe(false);
  });

  test.each(["bag.receive", "egg_count.create", "egg_count.read"])(
    "laboratory navigation accepts %s independently",
    (permission) => {
      expect(canOpenArea(makeMe({ permissions: [permission] }), area("lab"))).toBe(true);
    },
  );

  test("unrelated reading permissions do not grant laboratory navigation", () => {
    expect(canOpenArea(makeMe({ permissions: ["reading.read"] }), area("lab"))).toBe(false);
  });
});

describe("areas still waiting for a permission code", () => {
  // Each issue that builds an area replaces its "pending" with real codes and removes it here.
  test("are exactly these", () => {
    expect(pendingAreaIds()).toEqual([]);
  });

  test("Home and Settings are never pending", () => {
    expect(pendingAreaIds()).not.toContain("home");
    expect(pendingAreaIds()).not.toContain("settings");
  });
});

test.each(["organization.read", "role.read"])(
  "settings navigation needs %s without requiring a center grant",
  (permission) => {
    for (const mode of ["none", "selected"] as const) {
      const me = makeMe({
        permissions: [permission],
        scope: { centers: { mode, ids: [] }, quadrants: { mode: "none", ids: [] } },
      });
      expect(canOpenArea(me, area("settings"))).toBe(true);
    }
  },
);
