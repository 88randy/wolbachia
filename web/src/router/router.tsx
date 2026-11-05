import { ORGANIZATION_READ, ROLE_READ } from "../settings/organization/permissions";
import { W65Page } from "../settings/organization/W65Page";
import { W68Page } from "../settings/organization/W68Page";
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

const areaRoutes = AREAS.map((area) =>
  createRoute({
    getParentRoute: () => authenticatedRoute,
    path: area.path,
    beforeLoad: ({ context }) => {
      requireAreaAccess(area, context.me);
    },
    component:
      area.id === "settings"
        ? SettingsPage
        : area.id === "fleet"
          ? FleetHome
          : () => <AreaPlaceholder areaId={area.id} />,
    errorComponent: AreaErrorState,
  }),
);

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
const routeTree = rootRoute.addChildren([
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  legacyResetPasswordRoute,
  selectOrganizationRoute,
  authenticatedRoute.addChildren([
    ...areaRoutes,
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
