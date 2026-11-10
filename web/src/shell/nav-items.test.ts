import { describe, expect, test, vi } from "vitest";
import { makeMe } from "../test/fake-api";
import { visibleNavGroups } from "./nav-items";

function idsOf(me: Parameters<typeof visibleNavGroups>[0]): string[] {
  return visibleNavGroups(me).flatMap((group) => group.areas.map((area) => area.id));
}

describe("visibleNavGroups", () => {
  test("a user with all required area read permissions sees every area", () => {
    expect(
      idsOf(
        makeMe({
          permissions: [
            "incident.read",
            "review_item.read",
            "rule_parameter.read",
            "motorcycle.read",
            "quadrant.read",
            "location.read",
          ],
        }),
      ),
    ).toHaveLength(13);
  });

  test("a user with no permissions sees Home and pending areas, not Settings or Inventory", () => {
    const ids = idsOf(makeMe({ permissions: [] }));

    expect(ids).toContain("home");
    expect(ids).toContain("lab");
    expect(ids).not.toContain("settings");
    expect(ids).not.toContain("inventory");
    expect(ids).not.toContain("operations");
  });

  test("any one of the Settings codes opens Settings", () => {
    for (const code of ["catalog.read", "rule_parameter.read", "device.read"]) {
      expect(idsOf(makeMe({ permissions: [code] }))).toContain("settings");
    }
  });

  test("profile names grant nothing: an admin profile without permission codes has no Settings", () => {
    const me = makeMe({
      profiles: [{ slug: "admin", label_es: "Administrador", label_en: "Administrator" }],
      permissions: [],
    });

    expect(idsOf(me)).not.toContain("settings");
  });
});

describe("visibleNavGroups with every restricted area denied", () => {
  test("a group left empty disappears with its heading, and Home stays", async () => {
    vi.resetModules();
    vi.doMock("../router/area-access", () => ({
      canOpenArea: (_me: unknown, area: { id: string }) => area.id === "home",
    }));
    const { visibleNavGroups: restricted } = await import("./nav-items");

    const groups = restricted(makeMe({ permissions: [] }));

    expect(groups.map((group) => group.id)).toEqual(["main"]);
    vi.doUnmock("../router/area-access");
  });
});
