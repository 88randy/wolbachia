import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { ForgotPasswordPage } from "../auth/ForgotPasswordPage";
import { LoginPage } from "../auth/LoginPage";
import { LegacyResetPasswordPage } from "../auth/LegacyResetPasswordPage";
import { ResetPasswordPage } from "../auth/ResetPasswordPage";
import { SelectOrganizationPage } from "../auth/SelectOrganizationPage";
import { AppShell } from "../shell/AppShell";
import { AreaErrorState } from "../states/AreaErrorState";
import { AreaPlaceholder } from "../states/AreaPlaceholder";
import { NotFoundState } from "../states/NotFoundState";
import { PendingState } from "../states/PendingState";
import { RouteErrorState } from "../states/RouteErrorState";
import { AREAS } from "./areas";
import { requireAreaAccess, requireOrganization, requireOrganizationChoice } from "./guards";
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
    component: () => <AreaPlaceholder areaId={area.id} />,
    errorComponent: AreaErrorState,
  }),
);

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
  authenticatedRoute.addChildren([...areaRoutes, notFoundRoute]),
]);

interface AppRouterOptions extends RouterContext {
  /** Only passed by tests (memory history); the browser history is the default. */
  history?: RouterHistory;
}

export function createAppRouter({ client, queryClient, history }: AppRouterOptions) {
  return createRouter({
    routeTree,
    context: { client, queryClient },
    ...(history ? { history } : {}),
    defaultNotFoundComponent: NotFoundState,
    defaultErrorComponent: RouteErrorState,
    defaultPendingComponent: PendingState,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
