import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { MOTORCYCLE_READ } from "./permissions";

const FleetHome = lazyRouteComponent(() => import("./FleetHome"), "FleetHome");
const W20Page = lazyRouteComponent(() => import("./W20Page"), "W20Page");
const W21Page = lazyRouteComponent(() => import("./W21Page"), "W21Page");

// W20-W21: the fleet area and both motorcycle routes require motorcycle.read.
const motorcyclesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/fleet/motorcycles",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("fleet", context.me, MOTORCYCLE_READ);
  },
  component: W20Page,
  errorComponent: AreaErrorState,
});
const motorcycleRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/fleet/motorcycles/$code",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("fleet", context.me, MOTORCYCLE_READ);
  },
  component: W21Page,
  errorComponent: AreaErrorState,
});

/** Fleet area: home, W20 motorcycles, W21 one motorcycle. */
export const fleetRoutes = [areaHomeRoute("fleet", FleetHome), motorcyclesRoute, motorcycleRoute];
