import { W6Page } from "../incidents/W6Page";
import { W7Page } from "../incidents/W7Page";
import { OperationsHome } from "../operations/OperationsHome";
import { W30Page } from "../operations/reviews/W30Page";
import { W31Page } from "../operations/relocations/W31Page";
import { W33Page } from "../operations/closure/W33Page";
import { InventoryHome } from "../inventory/InventoryHome";
import { InventoryScreen } from "../inventory/InventoryScreen";
import { W8Page } from "../inventory/supplies/W8Page";
import { W9Page } from "../inventory/lots/W9Page";
import { W10Page } from "../inventory/lots/W10Page";
import type { ReactElement } from "react";
import { W11Page } from "../inventory/locations/W11Page";
import { ORGANIZATION_READ, ROLE_READ } from "../settings/organization/permissions";
import { W65Page } from "../settings/organization/W65Page";
import { W68Page } from "../settings/organization/W68Page";
import { W22Page } from "../quadrants/geography/W22Page";
import { W23Page } from "../quadrants/geography/W23Page";
import { CatalogsPage } from "../catalogs/CatalogsPage";
import { W20Page } from "../fleet/W20Page";
import { W21Page } from "../fleet/W21Page";
import { FleetHome } from "../fleet/FleetHome";
import { MOTORCYCLE_READ } from "../fleet/permissions";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { ForgotPasswordPage } from "../auth/ForgotPasswordPage";
import { LoginPage } from "../auth/LoginPage";
import { LegacyResetPasswordPage } from "../auth/LegacyResetPasswordPage";
import { ResetPasswordPage } from "../auth/ResetPasswordPage";
import { SelectOrganizationPage } from "../auth/SelectOrganizationPage";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { PhonesPage } from "../devices/PhonesPage";
import { AppShell } from "../shell/AppShell";
import { SettingsPage } from "../settings/SettingsPage";
import { PHONES_PERMISSION } from "../devices/permissions";
import { RULE_PARAMETER_READ } from "../rules/permissions";
import { RuleParameterPage } from "../rules/RuleParameterPage";
import { RuleParametersPage } from "../rules/RuleParametersPage";
import { AreaErrorState } from "../states/AreaErrorState";
import { AreaPlaceholder } from "../states/AreaPlaceholder";
import { NotFoundState } from "../states/NotFoundState";
import { PendingState } from "../states/PendingState";
import { RouteErrorState } from "../states/RouteErrorState";
import { AREAS } from "./areas";
import { installSessionSync } from "../session/install-session-sync";
import { parseFlatSearch, stringifyFlatSearch } from "./flat-search";
import {
  requireAreaAccess,
  requireOrganization,
  requireOrganizationChoice,
  requirePermission,
} from "./guards";
import type { RouterContext } from "./router-context";
import { loginSearchSchema, redirectSearchSchema } from "./search-schemas";

export type { RouterContext } from "./router-context";

// Routes are written in code (no file-based generation): the list of areas is one array.
const rootRoute = createRootRouteWithContext<RouterContext>()();

// Public: no session needed, no shell.
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

// Must match the backend's WEB_PASSWORD_RESET_PATH ("/reset-password" by default): the reset
// email links to `<WEB_BASE_URL>/reset-password#uid=<uid>&token=<token>` (#58).
const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
});

// Links emailed before #58 keep the values in the path. Removal rule: web/README.md, decision 83.
const legacyResetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password/$uid/$token",
  component: LegacyResetPasswordPage,
});

// Needs a session but not an organization yet (that is what it is for).
const selectOrganizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/select-organization",
  validateSearch: redirectSearchSchema,
  beforeLoad: requireOrganizationChoice,
  component: SelectOrganizationPage,
});

// Everything else: a session and an active organization, inside the shell.
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  beforeLoad: requireOrganization,
  component: AppShell,
});

const areaRoutes = AREAS.filter((area) => area.id !== "inventory").map((area) =>
  createRoute({
    getParentRoute: () => authenticatedRoute,
    path: area.path,
    ...(["quadrants", "incidents"].includes(area.id) ? { validateSearch: tableSearchSchema } : {}),
    beforeLoad: ({ context }) => {
      requireAreaAccess(area, context.me);
    },
    component:
      area.id === "incidents"
        ? W6Page
        : area.id === "settings"
          ? SettingsPage
          : area.id === "operations"
            ? OperationsHome
            : area.id === "fleet"
              ? FleetHome
              : area.id === "quadrants"
                ? W22Page
                : () => <AreaPlaceholder areaId={area.id} />,
    errorComponent: AreaErrorState,
  }),
);

const incidentRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/incidents/$code",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("incidents", context.me, "incident.read");
  },
  component: W7Page,
  errorComponent: AreaErrorState,
});

const reviewsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/operations/reviews",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("operations", context.me, "review_item.read");
  },
  component: W30Page,
  errorComponent: AreaErrorState,
});
const relocationsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/operations/relocations",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("operations", context.me, "relocation.read");
  },
  component: W31Page,
  errorComponent: AreaErrorState,
});
const quadrantClosureRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/quadrants/$code/closure",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("quadrants", context.me, "quadrant.read");
    requirePermission("quadrants", context.me, "quadrant.close");
  },
  component: function QuadrantClosureRoute() {
    const { code } = quadrantClosureRoute.useParams();
    return <W33Page code={code} />;
  },
  errorComponent: AreaErrorState,
});

const quadrantVersionsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/quadrants/$code/versions",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("quadrants", context.me, "quadrant.read");
  },
  component: W23Page,
  errorComponent: AreaErrorState,
});

// W20-W21: the fleet area and both motorcycle routes require motorcycle.read.
const motorcyclesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/fleet/motorcycles",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("fleet", context.me, MOTORCYCLE_READ);
  },
  component: W20Page,
  errorComponent: AreaErrorState,
});
const motorcycleRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/fleet/motorcycles/$code",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("fleet", context.me, MOTORCYCLE_READ);
  },
  component: W21Page,
  errorComponent: AreaErrorState,
});

// W67, phones. Path `/<area>/<resource>` (CLAUDE.md, Web > Routes). The area guard above is any of
// the Settings codes; this screen needs its own, `device.read`.
const phonesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/phones",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, PHONES_PERMISSION);
  },
  component: PhonesPage,
  errorComponent: AreaErrorState,
});

// W62, rule parameters: the list and one parameter by its key (its human code). Both need
// `rule_parameter.read`; the page of a parameter shows the form and the history by their own codes.
const ruleParametersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/rule-parameters",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, RULE_PARAMETER_READ);
  },
  component: RuleParametersPage,
  errorComponent: AreaErrorState,
});

const ruleParameterRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/rule-parameters/$key",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, RULE_PARAMETER_READ);
  },
  component: RuleParameterPage,
  errorComponent: AreaErrorState,
});

// An unknown address behind the session is "not found" inside the shell; without a session the
// guard of the layout sends the visitor to sign in first.
const notFoundRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "$",
  component: NotFoundState,
});

const organizationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/organization",
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, ORGANIZATION_READ);
  },
  component: W68Page,
  errorComponent: AreaErrorState,
});
const rolesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/roles",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, ROLE_READ);
  },
  component: W65Page,
  errorComponent: AreaErrorState,
});
const catalogsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/catalogs",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, "catalog.read");
  },
  component: CatalogsPage,
  errorComponent: AreaErrorState,
});
const catalogRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings/catalogs/$slug",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("settings", context.me, "catalog.read");
  },
  component: CatalogsPage,
  errorComponent: AreaErrorState,
});
const inventoryLayout = createRoute({
  getParentRoute: () => authenticatedRoute,
  id: "inventory-context",
  component: InventoryScreen,
});
const inventoryHomeRoute = createRoute({
  getParentRoute: () => inventoryLayout,
  path: "/inventory",
  beforeLoad: ({ context }) => {
    const area = AREAS.find((entry) => entry.id === "inventory");
    if (!area) throw new Error("Inventory area configuration unavailable");
    requireAreaAccess(area, context.me);
  },
  component: InventoryHome,
  errorComponent: AreaErrorState,
});
function inventoryRoute<const Path extends string>(
  path: Path,
  options: { permission: string; component: () => ReactElement },
) {
  return createRoute({
    getParentRoute: () => inventoryLayout,
    path,
    validateSearch: tableSearchSchema,
    beforeLoad: ({ context }) => {
      requirePermission("inventory", context.me, options.permission);
    },
    component: options.component,
    errorComponent: AreaErrorState,
  });
}
const inventoryRoutes = [
  inventoryRoute("/inventory/supplies", { permission: "supply_type.read", component: W8Page }),
  inventoryRoute("/inventory/lots", { permission: "lot.read", component: W9Page }),
  inventoryRoute("/inventory/locations", { permission: "location.read", component: W11Page }),
  inventoryRoute("/inventory/lots/new", { permission: "lot.create", component: W10Page }),
  inventoryRoute("/inventory/supplies/$code", {
    permission: "supply_type.read",
    component: W8Page,
  }),
  inventoryRoute("/inventory/lots/$code", { permission: "lot.read", component: W10Page }),
  inventoryRoute("/inventory/locations/$code", { permission: "location.read", component: W11Page }),
];
const routeTree = rootRoute.addChildren([
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  legacyResetPasswordRoute,
  selectOrganizationRoute,
  authenticatedRoute.addChildren([
    ...areaRoutes,
    inventoryLayout.addChildren([inventoryHomeRoute, ...inventoryRoutes]),
    quadrantVersionsRoute,
    incidentRoute,
    reviewsRoute,
    relocationsRoute,
    quadrantClosureRoute,
    catalogsRoute,
    catalogRoute,
    motorcyclesRoute,
    motorcycleRoute,
    organizationRoute,
    rolesRoute,
    phonesRoute,
    ruleParametersRoute,
    ruleParameterRoute,
    notFoundRoute,
  ]),
]);

interface AppRouterOptions extends RouterContext {
  /** Only passed by tests (memory history); the browser history is the default. */
  history?: RouterHistory;
}

export function createAppRouter({ client, queryClient, history }: AppRouterOptions) {
  const router = createRouter({
    routeTree,
    context: { client, queryClient },
    parseSearch: parseFlatSearch,
    stringifySearch: stringifyFlatSearch,
    ...(history ? { history } : {}),
    defaultNotFoundComponent: NotFoundState,
    defaultErrorComponent: RouteErrorState,
    defaultPendingComponent: PendingState,
  });
  // At the root, before the first guard runs: a login in another tab during the initial `/me/`
  // must not be missed (#82).
  installSessionSync({ queryClient, client, invalidateRoutes: () => router.invalidate() });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
