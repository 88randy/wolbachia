import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { rootRoute } from "../router/base-routes";
import { PortalLayout } from "./PortalLayout";

const PortalHome = lazyRouteComponent(() => import("./PortalHome"), "PortalHome");
const PortalMap = lazyRouteComponent(() => import("./PortalMap"), "PortalMap");
const PortalTrends = lazyRouteComponent(() => import("./PortalTrends"), "PortalTrends");

/** One public page of the portal (W69 to W71): own layout, no session, aggregates only. */
function portalPage<const Path extends string>(path: Path, page: ReactNode) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    validateSearch: tableSearchSchema,
    component: () => <PortalLayout>{page}</PortalLayout>,
  });
}

export const portalRoutes = [
  portalPage("/portal/$orgSlug", <PortalHome />),
  portalPage("/portal/$orgSlug/trends", <PortalTrends />),
  portalPage("/portal/$orgSlug/map", <PortalMap />),
];
