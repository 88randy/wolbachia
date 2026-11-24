import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { AsyncRouteComponent } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { rootRoute } from "../router/base-routes";
import { withPreload } from "../router/with-preload";
import { PortalLayout } from "./PortalLayout";

const PortalHome = lazyRouteComponent(() => import("./PortalHome"), "PortalHome");
const PortalMap = lazyRouteComponent(() => import("./PortalMap"), "PortalMap");
const PortalTrends = lazyRouteComponent(() => import("./PortalTrends"), "PortalTrends");

/** One public page of the portal (W69 to W71): own layout, no session, aggregates only. */
function portalPage<const Path extends string>(path: Path, Page: AsyncRouteComponent<object>) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    validateSearch: tableSearchSchema,
    component: withPreload(
      () => (
        <PortalLayout>
          <Page />
        </PortalLayout>
      ),
      Page,
    ),
  });
}

export const portalRoutes = [
  portalPage("/portal/$orgSlug", PortalHome),
  portalPage("/portal/$orgSlug/trends", PortalTrends),
  portalPage("/portal/$orgSlug/map", PortalMap),
];
