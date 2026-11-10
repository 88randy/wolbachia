import { expect, test } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import type { ApiClient } from "@wolbachia/api-client";
import { AREAS } from "../router/areas";
import { createAppRouter } from "../router/router";
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

test("permit segments are translated and the record code stays literal", () => {
  expect(breadcrumbsOf("/releases/permits").map((part) => part.key)).toEqual([
    "shell.nav.releases",
    "permits.list.title",
  ]);
  expect(breadcrumbsOf("/releases/permit-types")[1]?.key).toBe("permits.types.title");
  const record = breadcrumbsOf("/releases/permits/PERMIT-DEMO-01")[2];
  expect(record).toMatchObject({ label: "PERMIT-DEMO-01", isLinked: false });
  expect(record?.key).toBeUndefined();
});

test("every static segment of a registered route has a breadcrumb label", () => {
  const router = createAppRouter({
    client: {} as ApiClient,
    queryClient: new QueryClient(),
    history: createMemoryHistory(),
  });
  const unlabeled = Object.keys(router.routesByPath).flatMap((path) => {
    const parts = path.split("/").filter(Boolean);
    if (!AREAS.some((area) => area.path === `/${parts[0] ?? ""}`)) return [];
    return breadcrumbsOf(path)
      .filter((entry, index) => !parts[index]?.startsWith("$") && entry.key === undefined)
      .map((entry) => `${path} -> ${entry.label}`);
  });
  expect(unlabeled).toEqual([]);
});
