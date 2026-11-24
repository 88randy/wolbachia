import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { RouteComponent } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { PHONES_PERMISSION } from "../devices/permissions";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { RULE_VERSION_READ } from "../rules/permissions";
import { AreaErrorState } from "../states/AreaErrorState";
import { API_KEY_READ } from "./api-keys/api-keys-queries";
import { ORGANIZATION_READ, ROLE_READ } from "./organization/permissions";

const CenterClosePage = lazyRouteComponent(
  () => import("./organization/centers/CenterClosePage"),
  "CenterClosePage",
);
const CenterDetailPage = lazyRouteComponent(
  () => import("./organization/centers/CenterDetailPage"),
  "CenterDetailPage",
);
const W49PersonPage = lazyRouteComponent(
  () => import("../people-admin/W49PersonPage"),
  "W49PersonPage",
);
const CatalogsPage = lazyRouteComponent(() => import("../catalogs/CatalogsPage"), "CatalogsPage");
const PhonesPage = lazyRouteComponent(() => import("../devices/PhonesPage"), "PhonesPage");
const RuleParameterPage = lazyRouteComponent(
  () => import("../rules/RuleParameterPage"),
  "RuleParameterPage",
);
const RuleParametersPage = lazyRouteComponent(
  () => import("../rules/RuleParametersPage"),
  "RuleParametersPage",
);
const ApiKeysPage = lazyRouteComponent(() => import("./api-keys/ApiKeysPage"), "ApiKeysPage");
const W64Page = lazyRouteComponent(() => import("./incident-types/W64Page"), "W64Page");
const W65Page = lazyRouteComponent(() => import("./organization/W65Page"), "W65Page");
const W68Page = lazyRouteComponent(() => import("./organization/W68Page"), "W68Page");
const CentersListPage = lazyRouteComponent(
  () => import("./organization/centers/CentersListPage"),
  "CentersListPage",
);
const SettingsPage = lazyRouteComponent(() => import("./SettingsPage"), "SettingsPage");
const W48UsersPage = lazyRouteComponent(
  () => import("../people-admin/W48UsersPage"),
  "W48UsersPage",
);

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
  settingsListRoute("/settings/rule-parameters", RULE_VERSION_READ, RuleParametersPage),
  settingsListRoute("/settings/rule-parameters/$key", RULE_VERSION_READ, RuleParameterPage),
  organizationRoute,
  centersRoute,
  centerRoute,
  centerCloseRoute,
  settingsListRoute("/settings/users", "user.read", W48UsersPage),
  personRoute,
  settingsListRoute("/settings/roles", ROLE_READ, W65Page),
  settingsListRoute("/settings/api-keys", API_KEY_READ, ApiKeysPage),
  settingsListRoute("/settings/catalogs", "catalog.read", CatalogsPage),
  settingsListRoute("/settings/catalogs/$slug", "catalog.read", CatalogsPage),
];
