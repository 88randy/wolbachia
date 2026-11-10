import { createRoute } from "@tanstack/react-router";
import type { RouteComponent } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { AreaErrorState } from "../states/AreaErrorState";
import { AREAS } from "./areas";
import type { Area, AreaId } from "./areas";
import { authenticatedRoute } from "./base-routes";
import { requireAreaAccess } from "./guards";

/** The configuration of one area (`router/areas.ts`), typed by its id. */
export function areaOf<const Id extends AreaId>(id: Id): Extract<Area, { id: Id }> {
  const area = AREAS.find((entry): entry is Extract<Area, { id: Id }> => entry.id === id);
  if (!area) throw new Error(`Unknown area "${id}"`);
  return area;
}

/** The home route of an area (`/<area>`), guarded by the area's permissions. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- keeps the literal path of the area for typed links.
export function areaHomeRoute<const Id extends AreaId>(id: Id, component: RouteComponent) {
  const area = areaOf(id);
  return createRoute({
    getParentRoute: () => authenticatedRoute,
    path: area.path,
    beforeLoad: ({ context }) => {
      requireAreaAccess(area, context.me);
    },
    component,
    errorComponent: AreaErrorState,
  });
}

/** Same as `areaHomeRoute`, for an area whose home is a list (filters and paging in the URL). */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- keeps the literal path of the area for typed links.
export function areaListHomeRoute<const Id extends AreaId>(id: Id, component: RouteComponent) {
  const area = areaOf(id);
  return createRoute({
    getParentRoute: () => authenticatedRoute,
    path: area.path,
    validateSearch: tableSearchSchema,
    beforeLoad: ({ context }) => {
      requireAreaAccess(area, context.me);
    },
    component,
    errorComponent: AreaErrorState,
  });
}
