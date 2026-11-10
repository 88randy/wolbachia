import { createRoute } from "@tanstack/react-router";
import "../router/crumb";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { RecordHistoryPage } from "./RecordHistoryPage";
import { SearchPage } from "./SearchPage";

const HOME_READ = "home.read";

const searchRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/search",
  staticData: { crumb: "discovery.search.title" },
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("home", context.me, HOME_READ);
  },
  component: SearchPage,
  errorComponent: AreaErrorState,
});

const recordHistoryRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/records/$recordType/$code",
  beforeLoad: ({ context }) => {
    requirePermission("home", context.me, HOME_READ);
  },
  component: RecordHistoryPage,
  errorComponent: AreaErrorState,
});

/** W3 universal search and W4 universal record history. Both need `home.read`. */
export const discoveryRoutes = [searchRoute, recordHistoryRoute];
