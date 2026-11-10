import { createRoute } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { PERMIT_MANAGE } from "./permits/permissions";
import { W43Page } from "./permits/W43Page";
import { W44Page } from "./permits/W44Page";
import { W45Page } from "./permits/W45Page";
import { ReleasesHome } from "./ReleasesHome";

// W43-W45: permit types, permits and one permit by its human code. All need permit.manage; the
// suspend action inside W45 checks permit.suspend on its own.
const permitTypesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/releases/permit-types",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("releases", context.me, PERMIT_MANAGE);
  },
  component: W43Page,
  errorComponent: AreaErrorState,
});
const permitsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/releases/permits",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("releases", context.me, PERMIT_MANAGE);
  },
  component: W44Page,
  errorComponent: AreaErrorState,
});
const permitRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/releases/permits/$code",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("releases", context.me, PERMIT_MANAGE);
  },
  component: W45Page,
  errorComponent: AreaErrorState,
});

/** Releases area: home, W43 permit types, W44 permits, W45 one permit. */
export const releaseRoutes = [
  areaHomeRoute("releases", ReleasesHome),
  permitTypesRoute,
  permitsRoute,
  permitRoute,
];
