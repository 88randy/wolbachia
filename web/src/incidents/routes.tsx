import { createRoute } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaListHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { W6Page } from "./W6Page";
import { W7Page } from "./W7Page";

const incidentRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/incidents/$code",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("incidents", context.me, "incident.read");
  },
  component: W7Page,
  errorComponent: AreaErrorState,
});

/** Incidents area: W6 list and W7 one incident by its human code. */
export const incidentRoutes = [areaListHomeRoute("incidents", W6Page), incidentRoute];
