import { createRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaOf } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { ForbiddenError, requireAreaAccess, requirePermission } from "../router/guards";
import { canAny } from "../session/can";
import { AreaErrorState } from "../states/AreaErrorState";
import { W15Page } from "./allocation/W15Page";
import { W16Page } from "./allocation/W16Page";
import { W17Page } from "./allocation/W17Page";
import { W39Page } from "./allocation/W39Page";
import { W18Page } from "./conditions/W18Page";
import { InventoryHome } from "./InventoryHome";
import { InventoryScreen } from "./InventoryScreen";
import { LABEL_PERMISSIONS } from "./labels/label-kinds";
import { W19Page } from "./labels/W19Page";
import { W11Page } from "./locations/W11Page";
import { W10Page } from "./lots/W10Page";
import { W9Page } from "./lots/W9Page";
import { W8Page } from "./supplies/W8Page";
import { NewTransferPage } from "./transfers/new/NewTransferPage";
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
  options: { permission: string; component: () => ReactElement; crumb?: MessageKey },
) {
  return createRoute({
    getParentRoute: () => inventoryLayout,
    path,
    validateSearch: tableSearchSchema,
    ...(options.crumb ? { staticData: { crumb: options.crumb } } : {}),
    beforeLoad: ({ context }) => {
      requirePermission("inventory", context.me, options.permission);
    },
    component: options.component,
    errorComponent: AreaErrorState,
  });
}
const inventoryRoutes = [
  inventoryRoute("/inventory/transfers", {
    crumb: "transfers.page.title",
    permission: "transfer.read",
    component: W12Page,
  }),
  inventoryRoute("/inventory/transfers/new", {
    crumb: "transfers.new.title",
    permission: "transfer.create",
    component: NewTransferPage,
  }),
  inventoryRoute("/inventory/transfers/$code", { permission: "transfer.read", component: W12Page }),
  inventoryRoute("/inventory/discrepancies", {
    crumb: "discrepancies.page.title",
    permission: "discrepancy.read",
    component: W14Page,
  }),
  inventoryRoute("/inventory/discrepancies/$code", {
    permission: "discrepancy.read",
    component: W14Page,
  }),
  inventoryRoute("/inventory/assignments", {
    crumb: "allocation.assignment.title",
    permission: "inventory.allocate",
    component: W15Page,
  }),
  inventoryRoute("/inventory/reconciliations", {
    crumb: "allocation.reconciliation.title",
    permission: "inventory.reconcile",
    component: W16Page,
  }),
  inventoryRoute("/inventory/write-offs", {
    crumb: "allocation.writeOff.title",
    permission: "inventory.write_off",
    component: W17Page,
  }),
  inventoryRoute("/inventory/supplies", {
    crumb: "inventory.page.supplies",
    permission: "supply_type.read",
    component: W8Page,
  }),
  inventoryRoute("/inventory/lots", {
    crumb: "inventory.page.lots",
    permission: "lot.read",
    component: W9Page,
  }),
  inventoryRoute("/inventory/locations", {
    crumb: "inventory.page.locations",
    permission: "location.read",
    component: W11Page,
  }),
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
const labelsRoute = createRoute({
  getParentRoute: () => inventoryLayout,
  path: "/inventory/labels",
  staticData: { crumb: "inventory.labels.title" },
  beforeLoad: ({ context }) => {
    if (!canAny(context.me, LABEL_PERMISSIONS)) throw new ForbiddenError("inventory");
  },
  component: W19Page,
  errorComponent: AreaErrorState,
});
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
  inventoryLayout.addChildren([
    inventoryHomeRoute,
    ...inventoryRoutes,
    labelsRoute,
    labWriteOffsRoute,
  ]),
];
