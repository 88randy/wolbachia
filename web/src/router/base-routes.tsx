import { createRootRouteWithContext, createRoute } from "@tanstack/react-router";
import { AppShell } from "../shell/AppShell";
import { requireOrganization } from "./guards";
import type { RouterContext } from "./router-context";

/** Root of the tree. Public routes hang from it directly. */
export const rootRoute = createRootRouteWithContext<RouterContext>()();

/**
 * Everything behind a session and an active organization, inside the shell. Every area module
 * (`web/src/<area>/routes.tsx`) hangs its routes from this one.
 */
export const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  beforeLoad: requireOrganization,
  component: AppShell,
});
