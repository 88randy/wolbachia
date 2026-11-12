import { createRoute } from "@tanstack/react-router";
import type { RouteComponent } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { ForbiddenError } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { AccessLogPage } from "./access/AccessLogPage";
import { ArcoPage } from "./arco/ArcoPage";
import { ExportsPage } from "./exports/ExportsPage";
import { PortalSettingsPage } from "./portal-settings/PortalSettingsPage";
import { RetentionPage } from "./retention/RetentionPage";
import { RegulatoryHome } from "./RegulatoryHome";
import { DataTransfersPage } from "./transfers/DataTransfersPage";

/** A screen of the area: needs the one permission that opens it (the backend re-checks). */
function screen<const Path extends string>(
  path: Path,
  permission: string,
  component: RouteComponent,
) {
  return createRoute({
    getParentRoute: () => authenticatedRoute,
    path,
    validateSearch: tableSearchSchema,
    beforeLoad: ({ context }) => {
      if (!context.me.permissions.includes(permission)) throw new ForbiddenError("regulatory");
    },
    component,
    errorComponent: AreaErrorState,
  });
}

/** Regulatory area: W59 transfers, W57 exports, W58 ARCO, W60 access log, portal settings. */
export const regulatoryRoutes = [
  areaHomeRoute("regulatory", RegulatoryHome),
  screen("/regulatory/data-transfers", "transfer_authorization.read", DataTransfersPage),
  screen("/regulatory/exports", "export.run", ExportsPage),
  screen("/regulatory/arco-requests", "arco_request.read", ArcoPage),
  screen("/regulatory/access-log", "access_log.read", () => <AccessLogPage tab="access" />),
  screen("/regulatory/access-log/export-receipts", "access_log.read", () => (
    <AccessLogPage tab="exports" />
  )),
  screen("/regulatory/retention", "access_log.read", RetentionPage),
  screen("/regulatory/portal-settings", "portal.manage", PortalSettingsPage),
];
