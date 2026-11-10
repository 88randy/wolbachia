import { createRoute } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { W47Page } from "./devices/W47Page";
import { PERMIT_MANAGE } from "./permits/permissions";
import { W43Page } from "./permits/W43Page";
import { W44Page } from "./permits/W44Page";
import { W45Page } from "./permits/W45Page";
import { RELEASE_READ } from "./records/releases-query";
import { W46DetailPage } from "./records/W46DetailPage";
import { W46Page } from "./records/W46Page";
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

// W46 releases and one release, W47 release devices: all need release.read.
const releasesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/releases/records",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("releases", context.me, RELEASE_READ);
  },
  component: W46Page,
  errorComponent: AreaErrorState,
});
const releaseRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/releases/records/$id",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("releases", context.me, RELEASE_READ);
  },
  component: W46DetailPage,
  errorComponent: AreaErrorState,
});
const devicesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/releases/devices",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("releases", context.me, RELEASE_READ);
  },
  component: W47Page,
  errorComponent: AreaErrorState,
});

/** Releases area: home, W46 releases, W47 devices, W43 permit types, W44 permits, W45 one permit. */
export const releaseRoutes = [
  areaHomeRoute("releases", ReleasesHome),
  releasesRoute,
  releaseRoute,
  devicesRoute,
  permitTypesRoute,
  permitsRoute,
  permitRoute,
];
