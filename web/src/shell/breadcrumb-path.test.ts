import { expect, test } from "vitest";
import { breadcrumbsOf } from "./breadcrumb-path";

test("inventory ancestors and new-lot are translated while real record codes stay literal", () => {
  expect(breadcrumbsOf("/inventory/lots/new").map((part) => part.key)).toEqual([
    "shell.nav.inventory",
    "inventory.page.lots",
    "inventory.page.newLot",
  ]);
  for (const resource of ["supplies", "lots", "locations"]) {
    const entries = breadcrumbsOf("/inventory/" + resource + "/locations");
    expect(entries[1]?.key).toBe("inventory.page." + resource);
    expect(entries[2]).toMatchObject({ label: "locations", isCurrent: true, isLinked: false });
    expect(entries[2]?.key).toBeUndefined();
  }
});
