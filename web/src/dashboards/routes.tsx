import { createRoute } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import "../router/crumb";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { DashboardsHome } from "./DashboardsHome";
import { W53Page, W54Page, W55Page } from "./dashboard-pages";
import { ENTOMOLOGY_READ, OPERATIONS_READ, WOLBACHIA_READ } from "./permissions";

function dashboardRoute<const Path extends string>(
  path: Path,
  permission: string,
  component: () => React.JSX.Element,
  crumb: MessageKey,
) {
  return createRoute({
    getParentRoute: () => authenticatedRoute,
    path,
    staticData: { crumb },
    validateSearch: tableSearchSchema,
    beforeLoad: ({ context }) => {
      requirePermission("dashboards", context.me, permission);
    },
    component,
    errorComponent: AreaErrorState,
  });
}

/** Analysis area: home, W55 operations, W53 entomology and W54 Wolbachia prevalence. */
export const dashboardsRoutes = [
  areaHomeRoute("dashboards", DashboardsHome),
  dashboardRoute(
    "/dashboards/operations",
    OPERATIONS_READ,
    W55Page,
    "analytics.dashboards.operations.title",
  ),
  dashboardRoute(
    "/dashboards/entomology",
    ENTOMOLOGY_READ,
    W53Page,
    "analytics.dashboards.entomology.title",
  ),
  dashboardRoute(
    "/dashboards/wolbachia-prevalence",
    WOLBACHIA_READ,
    W54Page,
    "analytics.dashboards.prevalence.title",
  ),
];
