import { createRoute } from "@tanstack/react-router";
import type { RouteComponent } from "@tanstack/react-router";
import { CatalogsPage } from "../catalogs/CatalogsPage";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { PHONES_PERMISSION } from "../devices/permissions";
import { PhonesPage } from "../devices/PhonesPage";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { RULE_PARAMETER_READ } from "../rules/permissions";
import { RuleParameterPage } from "../rules/RuleParameterPage";
import { RuleParametersPage } from "../rules/RuleParametersPage";
import { AreaErrorState } from "../states/AreaErrorState";
import { W64Page } from "./incident-types/W64Page";
import { ORGANIZATION_READ, ROLE_READ } from "./organization/permissions";
import { W65Page } from "./organization/W65Page";
import { W68Page } from "./organization/W68Page";
import { CenterClosePage } from "./organization/centers/CenterClosePage";
import { CenterDetailPage } from "./organization/centers/CenterDetailPage";
import { CentersListPage } from "./organization/centers/CentersListPage";
import { SettingsPage } from "./SettingsPage";
import { W48UsersPage } from "../people-admin/W48UsersPage";
import { W49PersonPage } from "../people-admin/W49PersonPage";

/** A Settings screen at `/settings/<resource>` that needs one permission code. */
function settingsListRoute<const Path extends string>(
  path: Path,
  permission: string,
  component: RouteComponent,
) {
  return createRoute({
    getParentRoute: () => authenticatedRoute,
    path,
    validateSearch: tableSearchSchema,
    beforeLoad: ({ context }) => {
      requirePermission("settings", context.me, permission);
    },
    component,
    errorComponent: AreaErrorState,
  });
}
const organizationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/organization",
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, ORGANIZATION_READ);
  },
  component: W68Page,
  errorComponent: AreaErrorState,
});

const centersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/organization/centers",
  validateSearch: tableSearchSchema,
  staticData: { crumb: "centersAdmin.page.title" },
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, "center.read");
  },
  component: CentersListPage,
  errorComponent: AreaErrorState,
});

const centerRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/organization/centers/$code",
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, "center.read");
  },
  component: function CenterRoute() {
    const { code } = centerRoute.useParams();
    return <CenterDetailPage key={code} code={code} />;
  },
  errorComponent: AreaErrorState,
});

const centerCloseRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/organization/centers/$code/close",
  staticData: { crumb: "centersAdmin.close.crumb" },
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, "center.deactivate");
  },
  component: function CenterCloseRoute() {
    const { code } = centerCloseRoute.useParams();
    return <CenterClosePage key={code} code={code} />;
  },
  errorComponent: AreaErrorState,
});

const personRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/users/$id",
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, "user.read");
  },
  component: function PersonRoute() {
    const { id } = personRoute.useParams();
    return <W49PersonPage key={id} id={id} />;
  },
  errorComponent: AreaErrorState,
});

/** Settings area: home, W62 rules, W63 catalogs, W64 incident types, W65 roles, W67 phones, W68 (+ centers), W48 users, W49 person. */
export const settingsRoutes = [
  areaHomeRoute("settings", SettingsPage),
  settingsListRoute("/settings/phones", PHONES_PERMISSION, PhonesPage),
  settingsListRoute("/settings/incident-types", "incident.manage_type", W64Page),
  settingsListRoute("/settings/rule-parameters", RULE_PARAMETER_READ, RuleParametersPage),
  settingsListRoute("/settings/rule-parameters/$key", RULE_PARAMETER_READ, RuleParameterPage),
  organizationRoute,
  centersRoute,
  centerRoute,
  centerCloseRoute,
  settingsListRoute("/settings/users", "user.read", W48UsersPage),
  personRoute,
  settingsListRoute("/settings/roles", ROLE_READ, W65Page),
  settingsListRoute("/settings/catalogs", "catalog.read", CatalogsPage),
  settingsListRoute("/settings/catalogs/$slug", "catalog.read", CatalogsPage),
];
