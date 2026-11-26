import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";

const W28Page = lazyRouteComponent(() => import("./live/W28Page"), "W28Page");
const OperationsHome = lazyRouteComponent(() => import("./OperationsHome"), "OperationsHome");
const W31Page = lazyRouteComponent(() => import("./relocations/W31Page"), "W31Page");
const W30Page = lazyRouteComponent(() => import("./reviews/W30Page"), "W30Page");
const ShiftsPage = lazyRouteComponent(() => import("./ShiftsPage"), "ShiftsPage");
const W29Page = lazyRouteComponent(() => import("./W29Page"), "W29Page");

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
