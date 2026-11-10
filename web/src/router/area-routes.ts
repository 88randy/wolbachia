/**
 * The one list of area route modules. Convention: each area owns `web/src/<area>/routes.tsx`,
 * which exports `<area>Routes`, an array of routes whose parent is `authenticatedRoute`
 * (`router/base-routes.tsx`). Adding a screen touches only its area module; adding a new area
 * adds one line here and its entry in `router/areas.ts`.
 */
import { dashboardsRoutes } from "../dashboards/routes";
import { fleetRoutes } from "../fleet/routes";
import { homeRoutes } from "../home/routes";
import { incidentRoutes } from "../incidents/routes";
import { inventoryAreaRoutes } from "../inventory/routes";
import { labRoutes } from "../lab/routes";
import { notificationRoutes } from "../notifications/routes";
import { operationRoutes } from "../operations/routes";
import { peopleRoutes } from "../people/routes";
import { quadrantRoutes } from "../quadrants/routes";
import { releaseRoutes } from "../releases/routes";
import { settingsRoutes } from "../settings/routes";
import { placeholderRoutes } from "../states/placeholder-routes";

export const areaRouteModules = [
  ...homeRoutes,
  ...notificationRoutes,
  ...incidentRoutes,
  ...operationRoutes,
  ...quadrantRoutes,
  ...releaseRoutes,
  ...inventoryAreaRoutes,
  ...fleetRoutes,
  ...labRoutes,
  ...peopleRoutes,
  ...dashboardsRoutes,
  ...settingsRoutes,
  ...placeholderRoutes,
];
