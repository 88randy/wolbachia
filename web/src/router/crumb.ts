import type { MessageKey } from "@wolbachia/i18n";

/**
 * Breadcrumb label of a route, declared where the route is registered:
 * `createRoute({ ..., staticData: { crumb: "lab.paddles.title" } })`. The breadcrumb uses it for
 * that path segment, so a new screen gets its label without touching the shell.
 */
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    crumb?: MessageKey;
  }
}

export {};
