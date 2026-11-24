import type { RouteComponent } from "@tanstack/react-router";
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import "../router/crumb";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { ForbiddenError, requirePermission } from "../router/guards";
import { can } from "../session/can";
import { AreaErrorState } from "../states/AreaErrorState";
import { pcrRoutes } from "./pcr/routes";

const LabHome = lazyRouteComponent(() => import("./LabHome"), "LabHome");
const W34Page = lazyRouteComponent(() => import("./W34Page"), "W34Page");
const W35HistoryPage = lazyRouteComponent(() => import("./W35HistoryPage"), "W35HistoryPage");
const W35Page = lazyRouteComponent(() => import("./W35Page"), "W35Page");
const W35AnnotationPage = lazyRouteComponent(
  () => import("./W35AnnotationPage"),
  "W35AnnotationPage",
);
const W36Page = lazyRouteComponent(() => import("./W36Page"), "W36Page");
const W37Page = lazyRouteComponent(() => import("./W37Page"), "W37Page");
const W38Page = lazyRouteComponent(() => import("./W38Page"), "W38Page");
const W40Page = lazyRouteComponent(() => import("./W40Page"), "W40Page");
const W41Page = lazyRouteComponent(() => import("./W41Page"), "W41Page");

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
const eggAnnotationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/lab/egg-counts/$bagCode/annotate",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context, search }) => {
    requirePermission("lab", context.me, "egg_count.create");
    if (search.correction === "true") {
      requirePermission("lab", context.me, "egg_count.read");
      requirePermission("lab", context.me, "egg_count.void");
      requirePermission("lab", context.me, "catalog.read");
    }
  },
  component: W35AnnotationPage,
  errorComponent: AreaErrorState,
});

function listRoute<const Path extends string>(
  path: Path,
  permission: string,
  component: RouteComponent,
  crumb: MessageKey,
) {
  return createRoute({
    getParentRoute: () => authenticatedRoute,
    path,
    staticData: { crumb },
    validateSearch: tableSearchSchema,
    beforeLoad: ({ context }) => {
      requirePermission("lab", context.me, permission);
    },
    component,
    errorComponent: AreaErrorState,
  });
}
const recountsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/lab/recounts",
  staticData: { crumb: "lab.recounts.title" },
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    if (!can(context.me, "recount.create") && !can(context.me, "recount.adjudicate"))
      throw new ForbiddenError("lab");
  },
  component: W36Page,
  errorComponent: AreaErrorState,
});
const paddlesRoute = listRoute("/lab/paddles", "egg_paddle.reuse", W37Page, "lab.paddles.title");
const shipmentsRoute = listRoute("/lab/shipments", "shipment.read", W38Page, "lab.shipments.title");
const resultsRoute = listRoute("/lab/results", "sample.read", W40Page, "lab.results.title");
const materialsRoute = listRoute(
  "/lab/material-requests",
  "material_request.read",
  W41Page,
  "lab.materials.title",
);

/**
 * Lab area: home, W34 reception, W35 count and history, W36-W38, W40 and W41. W39 (`/lab/write-offs`) lives in
 * `inventory/routes.tsx` because it needs the inventory context layout.
 */
export const labRoutes = [
  areaHomeRoute("lab", LabHome),
  labReceptionRoute,
  eggCountsRoute,
  eggAnnotationRoute,
  eggCountHistoryRoute,
  recountsRoute,
  paddlesRoute,
  shipmentsRoute,
  resultsRoute,
  materialsRoute,
  ...pcrRoutes,
];
