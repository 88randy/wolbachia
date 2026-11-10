import { createRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { rootRoute } from "../router/base-routes";
import { PortalHome } from "./PortalHome";
import { PortalLayout } from "./PortalLayout";
import { PortalMap } from "./PortalMap";
import { PortalTrends } from "./PortalTrends";

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
