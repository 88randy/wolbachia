import type { ReactElement } from "react";
import { createRoute } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import "../router/crumb";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { ForbiddenError, requirePermission } from "../router/guards";
import { can } from "../session/can";
import { AreaErrorState } from "../states/AreaErrorState";
import { LabHome } from "./LabHome";
import { W34Page } from "./W34Page";
import { W35HistoryPage } from "./W35HistoryPage";
import { W35Page } from "./W35Page";
import { W36Page } from "./W36Page";
import { W37Page } from "./W37Page";
import { W38Page } from "./W38Page";
import { W40Page } from "./W40Page";
import { W41Page } from "./W41Page";

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

function listRoute<const Path extends string>(
  path: Path,
  permission: string,
  component: () => ReactElement,
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
  eggCountHistoryRoute,
  recountsRoute,
  paddlesRoute,
  shipmentsRoute,
  resultsRoute,
  materialsRoute,
];
