import { createRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import "../router/crumb";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaListHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { withPreload } from "../router/with-preload";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";

const W33Page = lazyRouteComponent(() => import("../operations/closure/W33Page"), "W33Page");
const W23MapEditorPage = lazyRouteComponent(
  () => import("./editor/W23MapEditorPage"),
  "W23MapEditorPage",
);
const W22Page = lazyRouteComponent(() => import("./geography/W22Page"), "W22Page");
const W23Page = lazyRouteComponent(() => import("./geography/W23Page"), "W23Page");
const PointPage = lazyRouteComponent(() => import("./point/PointPage"), "PointPage");

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
const quadrantPointRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/quadrants/$code/points/$pointCode",
  beforeLoad: ({ context }) => {
    requirePermission("quadrants", context.me, "quadrant.read");
  },
  component: PointPage,
  errorComponent: AreaErrorState,
});
const mapEditorRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/quadrants/editor",
  validateSearch: (search: Record<string, unknown>): { tool?: "quadrant" } =>
    search["tool"] === "quadrant" ? { tool: "quadrant" } : {},
  beforeLoad: ({ context }) => {
    requirePermission("quadrants", context.me, "quadrant.read");
  },
  component: withPreload(function MapEditorRoute() {
    const { tool } = mapEditorRoute.useSearch();
    return <W23MapEditorPage startTool={tool} />;
  }, W23MapEditorPage),
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
  component: withPreload(function QuadrantClosureRoute() {
    const { code } = quadrantClosureRoute.useParams();
    return <W33Page code={code} />;
  }, W33Page),
  errorComponent: AreaErrorState,
});
// Old address shared in demo notes: quadrants live under their own area, not under Operations.
const legacyQuadrantsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/operations/quadrants",
  staticData: { crumb: "shell.nav.quadrants" },
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- router redirects are thrown by design.
    throw redirect({ to: "/quadrants", replace: true });
  },
});

/** Quadrants area: W22 map and list, W23 map editor and versions, W33 closure, and the read-only page of a point. */
export const quadrantRoutes = [
  areaListHomeRoute("quadrants", W22Page),
  mapEditorRoute,
  quadrantVersionsRoute,
  quadrantPointRoute,
  quadrantClosureRoute,
  legacyQuadrantsRoute,
];
