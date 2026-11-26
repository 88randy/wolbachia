import { lazyRouteComponent } from "@tanstack/react-router";
import { areaListHomeRoute } from "../router/area-route";

const W5Page = lazyRouteComponent(() => import("./W5Page"), "W5Page");

/** Notifications area: W5 inbox. */
export const notificationRoutes = [areaListHomeRoute("notifications", W5Page)];
