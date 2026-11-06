import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { RouterContext } from "../src/router/router-context";
import { requireOrganization } from "../src/router/guards";
import { AREAS } from "../src/router/areas";
import { parseFlatSearch, stringifyFlatSearch } from "../src/router/flat-search";
import { PreviewShell } from "./PreviewShell";
/** Use the normal session guard with an in-memory server; no production API is contacted. */
export function createPreviewRouter(context: RouterContext) {
  const root = createRootRouteWithContext<RouterContext>()({ beforeLoad: requireOrganization });
  const routes = AREAS.map((area) =>
    createRoute({
      getParentRoute: () => root,
      path: area.path,
      component: PreviewShell,
      validateSearch: (search: Record<string, unknown>) => search,
    }),
  );
  return createRouter({
    routeTree: root.addChildren(routes),
    context,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    parseSearch: parseFlatSearch,
    stringifySearch: stringifyFlatSearch,
  });
}
