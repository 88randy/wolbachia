import { RouterProvider } from "@tanstack/react-router";
import type { createAppRouter } from "../router/router";

/** Root of the React tree: the router renders the shell and the current area. */
export function App({ router }: { router: ReturnType<typeof createAppRouter> }) {
  return <RouterProvider router={router} />;
}
