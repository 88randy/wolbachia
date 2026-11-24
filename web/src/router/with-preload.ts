import type { RouteComponent } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * A route component that renders a lazy screen (`lazyRouteComponent`) with props from the route.
 * It forwards the screen's `preload`, so the router loads the chunk before rendering, as it does
 * for a plain lazy `component`, instead of suspending into the pending state.
 */
export function withPreload(
  component: () => ReactNode,
  screen: { preload?: () => Promise<void> | undefined },
): RouteComponent {
  return Object.assign(component, { preload: () => screen.preload?.() });
}
