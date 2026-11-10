import { areaHomeRoute } from "../router/area-route";
import { HomePage } from "./HomePage";

/** Home (W1): every signed-in member. */
export const homeRoutes = [areaHomeRoute("home", HomePage)];
