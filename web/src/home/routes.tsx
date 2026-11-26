import { lazyRouteComponent } from "@tanstack/react-router";
import { areaHomeRoute } from "../router/area-route";

const HomePage = lazyRouteComponent(() => import("./HomePage"), "HomePage");

/** Home (W1): every signed-in member. */
export const homeRoutes = [areaHomeRoute("home", HomePage)];
