import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { AppShell } from "../shell/AppShell";
import { AreaPlaceholder } from "../states/AreaPlaceholder";
import { NotFoundState } from "../states/NotFoundState";
import { PendingState } from "../states/PendingState";
import { RouteErrorState } from "../states/RouteErrorState";
import { AREAS } from "./areas";

// Routes are written in code (no file-based generation): the list of areas is one array.
const rootRoute = createRootRoute({ component: AppShell });

const areaRoutes = AREAS.map((area) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: area.path,
    component: () => <AreaPlaceholder areaId={area.id} />,
  }),
);

/** `history` is only passed by tests (memory history); the browser history is the default. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree: rootRoute.addChildren(areaRoutes),
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
