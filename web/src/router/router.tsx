import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import type { ApiClient } from "@wolbachia/api-client";
import { AppShell } from "../shell/AppShell";
import { AreaPlaceholder } from "../states/AreaPlaceholder";
import { NotFoundState } from "../states/NotFoundState";
import { PendingState } from "../states/PendingState";
import { RouteErrorState } from "../states/RouteErrorState";
import { AREAS } from "./areas";

/** What every route can reach: the one API client and the server-state cache. */
export interface RouterContext {
  client: ApiClient;
  queryClient: QueryClient;
}

// Routes are written in code (no file-based generation): the list of areas is one array.
const rootRoute = createRootRouteWithContext<RouterContext>()({ component: AppShell });

const areaRoutes = AREAS.map((area) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: area.path,
    component: () => <AreaPlaceholder areaId={area.id} />,
  }),
);

interface AppRouterOptions extends RouterContext {
  /** Only passed by tests (memory history); the browser history is the default. */
  history?: RouterHistory;
}

export function createAppRouter({ client, queryClient, history }: AppRouterOptions) {
  return createRouter({
    routeTree: rootRoute.addChildren(areaRoutes),
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
