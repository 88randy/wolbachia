import { createRoute, createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { portalRoutes } from "../portal/routes";
import { ForgotPasswordPage } from "../auth/ForgotPasswordPage";
import { LoginPage } from "../auth/LoginPage";
import { LegacyResetPasswordPage } from "../auth/LegacyResetPasswordPage";
import { ResetPasswordPage } from "../auth/ResetPasswordPage";
import { SelectOrganizationPage } from "../auth/SelectOrganizationPage";
import { installSessionSync } from "../session/install-session-sync";
import { NotFoundState } from "../states/NotFoundState";
import { PendingState } from "../states/PendingState";
import { RouteErrorState } from "../states/RouteErrorState";
import { areaRouteModules } from "./area-routes";
import { authenticatedRoute, rootRoute } from "./base-routes";
import { parseFlatSearch, stringifyFlatSearch } from "./flat-search";
import { requireOrganizationChoice } from "./guards";
import type { RouterContext } from "./router-context";
import { loginSearchSchema, redirectSearchSchema } from "./search-schemas";

export type { RouterContext } from "./router-context";

// Routes are written in code (no file-based generation). Public routes live here; every area
// owns its routes in `web/src/<area>/routes.tsx`, listed once in `./area-routes.ts`.

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

// An unknown address behind the session is "not found" inside the shell; without a session the
// guard of the layout sends the visitor to sign in first.
const notFoundRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "$",
  component: NotFoundState,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  legacyResetPasswordRoute,
  selectOrganizationRoute,
  ...portalRoutes,
  authenticatedRoute.addChildren([...areaRouteModules, notFoundRoute]),
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
