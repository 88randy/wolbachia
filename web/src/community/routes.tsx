import { lazyRouteComponent } from "@tanstack/react-router";
import { areaListHomeRoute } from "../router/area-route";

const W52Page = lazyRouteComponent(() => import("./W52Page"), "W52Page");

/** Community area: its home is W52, the list of activities (filters and paging in the URL). */
export const communityRoutes = [areaListHomeRoute("community", W52Page)];
