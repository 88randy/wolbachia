import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaOf } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requireAreaAccess, requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { W15Page } from "./allocation/W15Page";
import { W16Page } from "./allocation/W16Page";
import { W17Page } from "./allocation/W17Page";
import { W39Page } from "./allocation/W39Page";
import { W18Page } from "./conditions/W18Page";
import { InventoryHome } from "./InventoryHome";
import { InventoryScreen } from "./InventoryScreen";
import { W11Page } from "./locations/W11Page";
import { W10Page } from "./lots/W10Page";
import { W9Page } from "./lots/W9Page";
import { W8Page } from "./supplies/W8Page";
import { W12Page } from "./transfers/W12Page";
import { W14Page } from "./transfers/W14Page";

/** Shared inventory context (catalogs, locations) for every inventory screen and W39. */
const inventoryLayout = createRoute({
  getParentRoute: () => authenticatedRoute,
  id: "inventory-context",
  component: InventoryScreen,
});
const inventoryHomeRoute = createRoute({
  getParentRoute: () => inventoryLayout,
  path: "/inventory",
  beforeLoad: ({ context }) => {
    requireAreaAccess(areaOf("inventory"), context.me);
  },
  component: InventoryHome,
  errorComponent: AreaErrorState,
});
function inventoryRoute<const Path extends string>(
  path: Path,
  options: { permission: string; component: () => ReactElement },
) {
  return createRoute({
    getParentRoute: () => inventoryLayout,
    path,
    validateSearch: tableSearchSchema,
    beforeLoad: ({ context }) => {
      requirePermission("inventory", context.me, options.permission);
    },
    component: options.component,
    errorComponent: AreaErrorState,
  });
}
const inventoryRoutes = [
  inventoryRoute("/inventory/transfers", { permission: "transfer.read", component: W12Page }),
  inventoryRoute("/inventory/transfers/$code", { permission: "transfer.read", component: W12Page }),
  inventoryRoute("/inventory/discrepancies", {
    permission: "discrepancy.read",
    component: W14Page,
  }),
  inventoryRoute("/inventory/discrepancies/$code", {
    permission: "discrepancy.read",
    component: W14Page,
  }),
  inventoryRoute("/inventory/assignments", {
    permission: "inventory.allocate",
    component: W15Page,
  }),
  inventoryRoute("/inventory/reconciliations", {
    permission: "inventory.reconcile",
    component: W16Page,
  }),
  inventoryRoute("/inventory/write-offs", {
    permission: "inventory.write_off",
    component: W17Page,
  }),
  inventoryRoute("/inventory/supplies", { permission: "supply_type.read", component: W8Page }),
  inventoryRoute("/inventory/lots", { permission: "lot.read", component: W9Page }),
  inventoryRoute("/inventory/locations", { permission: "location.read", component: W11Page }),
  inventoryRoute("/inventory/lots/new", { permission: "lot.create", component: W10Page }),
  inventoryRoute("/inventory/supplies/$code", {
    permission: "supply_type.read",
    component: W8Page,
  }),
  inventoryRoute("/inventory/lots/$code", { permission: "lot.read", component: W10Page }),
  inventoryRoute("/inventory/lots/$code/conditions", {
    permission: "lot.read",
    component: W18Page,
  }),
  inventoryRoute("/inventory/locations/$code", { permission: "location.read", component: W11Page }),
];
const labWriteOffsRoute = createRoute({
  getParentRoute: () => inventoryLayout,
  path: "/lab/write-offs",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("lab", context.me, "bag.dispose");
  },
  component: W39Page,
  errorComponent: AreaErrorState,
});

/** Inventory area (W8-W18) plus W39, all inside the inventory context layout. */
export const inventoryAreaRoutes = [
  inventoryLayout.addChildren([inventoryHomeRoute, ...inventoryRoutes, labWriteOffsRoute]),
];
