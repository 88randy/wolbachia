import { createRoute } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { W28Page } from "./live/W28Page";
import { OperationsHome } from "./OperationsHome";
import { W31Page } from "./relocations/W31Page";
import { W30Page } from "./reviews/W30Page";
import { ShiftsPage } from "./ShiftsPage";
import { W29Page } from "./W29Page";

const reviewsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/operations/reviews",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("operations", context.me, "review_item.read");
  },
  component: W30Page,
  errorComponent: AreaErrorState,
});
const relocationsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/operations/relocations",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("operations", context.me, "relocation.read");
  },
  component: W31Page,
  errorComponent: AreaErrorState,
});
const shiftsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/operations/shifts",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("operations", context.me, "shift.read");
  },
  component: ShiftsPage,
  errorComponent: AreaErrorState,
});
const liveRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/operations/live",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("operations", context.me, "shift.read");
  },
  component: W28Page,
  errorComponent: AreaErrorState,
});
const shiftRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/operations/shifts/$code",
  beforeLoad: ({ context }) => {
    requirePermission("operations", context.me, "shift.read");
  },
  component: W29Page,
  errorComponent: AreaErrorState,
});

/** Operations area: home, W30 reviews, W31 relocations, W28-W29 shifts. */
export const operationRoutes = [
  areaHomeRoute("operations", OperationsHome),
  reviewsRoute,
  relocationsRoute,
  liveRoute,
  shiftsRoute,
  shiftRoute,
];
