import { areaListHomeRoute } from "../router/area-route";
import { W52Page } from "./W52Page";

/** Community area: its home is W52, the list of activities (filters and paging in the URL). */
export const communityRoutes = [areaListHomeRoute("community", W52Page)];
