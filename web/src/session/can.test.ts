import { describe, expect, test } from "vitest";
import { makeMe } from "../test/fake-api";
import { can, canAny } from "./can";

describe("can", () => {
  const me = makeMe({ permissions: ["catalog.read", "device.read"] });

  test.each([
    ["catalog.read", true],
    ["device.read", true],
    ["catalog.update", false],
    ["catalog", false],
    ["", false],
  ])("%j -> %s", (permission, expected) => {
    expect(can(me, permission)).toBe(expected);
  });

  test("a user without an active organization has no permissions", () => {
    const chooser = makeMe({ organization: null, profiles: [], permissions: [] });

    expect(can(chooser, "catalog.read")).toBe(false);
  });

  test("profile names never grant anything", () => {
    const admin = makeMe({
      profiles: [{ slug: "admin", label_es: "Administrador", label_en: "Administrator" }],
      permissions: [],
    });

    expect(can(admin, "catalog.read")).toBe(false);
  });
});

describe("canAny", () => {
  const me = makeMe({ permissions: ["device.read"] });

  test("is true when one of the codes is held", () => {
    expect(canAny(me, ["catalog.read", "device.read"])).toBe(true);
  });

  test("is false when none is held, and for an empty list", () => {
    expect(canAny(me, ["catalog.read"])).toBe(false);
    expect(canAny(me, [])).toBe(false);
  });
});
