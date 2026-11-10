import { createRoute } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { LabHome } from "./LabHome";
import { W34Page } from "./W34Page";
import { W35HistoryPage } from "./W35HistoryPage";
import { W35Page } from "./W35Page";

const labReceptionRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/lab/bags",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("lab", context.me, "bag.receive");
  },
  component: W34Page,
  errorComponent: AreaErrorState,
});
const eggCountsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/lab/egg-counts",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("lab", context.me, "egg_count.create");
  },
  component: W35Page,
  errorComponent: AreaErrorState,
});
const eggCountHistoryRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/lab/count-history",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("lab", context.me, "egg_count.read");
  },
  component: W35HistoryPage,
  errorComponent: AreaErrorState,
});

/**
 * Lab area: home, W34 reception, W35 count and history. W39 (`/lab/write-offs`) lives in
 * `inventory/routes.tsx` because it needs the inventory context layout.
 */
export const labRoutes = [
  areaHomeRoute("lab", LabHome),
  labReceptionRoute,
  eggCountsRoute,
  eggCountHistoryRoute,
];
