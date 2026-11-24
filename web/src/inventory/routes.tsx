import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { RouteComponent } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaOf } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { ForbiddenError, requireAreaAccess, requirePermission } from "../router/guards";
import { canAny } from "../session/can";
import { AreaErrorState } from "../states/AreaErrorState";
import { InventoryScreen } from "./InventoryScreen";
import { LABEL_PERMISSIONS, labelsSearchSchema } from "../labels/label-kinds";

const DeliveryList = lazyRouteComponent(() => import("./allocation/DeliveryList"), "DeliveryList");
const W15Page = lazyRouteComponent(() => import("./allocation/W15Page"), "W15Page");
const W16Page = lazyRouteComponent(() => import("./allocation/W16Page"), "W16Page");
const W17Page = lazyRouteComponent(() => import("./allocation/W17Page"), "W17Page");
const W39Page = lazyRouteComponent(() => import("./allocation/W39Page"), "W39Page");
const W18Page = lazyRouteComponent(() => import("./conditions/W18Page"), "W18Page");
const InventoryHome = lazyRouteComponent(() => import("./InventoryHome"), "InventoryHome");
const W19Page = lazyRouteComponent(() => import("./labels/W19Page"), "W19Page");
const W11Page = lazyRouteComponent(() => import("./locations/W11Page"), "W11Page");
const W10Page = lazyRouteComponent(() => import("./lots/W10Page"), "W10Page");
const W9Page = lazyRouteComponent(() => import("./lots/W9Page"), "W9Page");
const W8Page = lazyRouteComponent(() => import("./supplies/W8Page"), "W8Page");
const NewTransferPage = lazyRouteComponent(
  () => import("./transfers/new/NewTransferPage"),
  "NewTransferPage",
);
const W12Page = lazyRouteComponent(() => import("./transfers/W12Page"), "W12Page");
const W14Page = lazyRouteComponent(() => import("./transfers/W14Page"), "W14Page");

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
  options: { permission: string; component: RouteComponent; crumb?: MessageKey },
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
    component: DeliveryList,
  }),
  inventoryRoute("/inventory/assignments/new", {
    crumb: "allocation.delivery.new",
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
  validateSearch: labelsSearchSchema,
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
