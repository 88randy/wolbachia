import { createRoute, redirect } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { W33Page } from "../operations/closure/W33Page";
import { areaListHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { W22Page } from "./geography/W22Page";
import { W23Page } from "./geography/W23Page";

const quadrantVersionsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/quadrants/$code/versions",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("quadrants", context.me, "quadrant.read");
  },
  component: W23Page,
  errorComponent: AreaErrorState,
});
const quadrantClosureRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/quadrants/$code/closure",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("quadrants", context.me, "quadrant.read");
    requirePermission("quadrants", context.me, "quadrant.close");
  },
  component: function QuadrantClosureRoute() {
    const { code } = quadrantClosureRoute.useParams();
    return <W33Page code={code} />;
  },
  errorComponent: AreaErrorState,
});
// Old address shared in demo notes: quadrants live under their own area, not under Operations.
const legacyQuadrantsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/operations/quadrants",
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- router redirects are thrown by design.
    throw redirect({ to: "/quadrants", replace: true });
  },
});

/** Quadrants area: W22 map and list, W23 versions, W33 closure. */
export const quadrantRoutes = [
  areaListHomeRoute("quadrants", W22Page),
  quadrantVersionsRoute,
  quadrantClosureRoute,
  legacyQuadrantsRoute,
];
