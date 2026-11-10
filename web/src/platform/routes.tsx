import { createRoute } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaListHomeRoute, areaOf } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requireAreaAccess } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { OrganizationDetailPage } from "./OrganizationDetailPage";
import { OrganizationsPage } from "./OrganizationsPage";
import { NewOrganizationWizard } from "./wizard/NewOrganizationWizard";

const area = areaOf("platform");

const newOrganizationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/platform/new-organization",
  staticData: { crumb: "platform.wizard.title" },
  beforeLoad: ({ context }) => {
    requireAreaAccess(area, context.me);
  },
  component: NewOrganizationWizard,
  errorComponent: AreaErrorState,
});

const organizationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/platform/$slug",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requireAreaAccess(area, context.me);
  },
  component: function OrganizationRoute() {
    const { slug } = organizationRoute.useParams();
    const search = organizationRoute.useSearch();
    return <OrganizationDetailPage slug={slug} highlightLogo={search["logo"] === "1"} />;
  },
  errorComponent: AreaErrorState,
});

/** Platform area: organizations list, the new-organization wizard and an organization record. */
export const platformRoutes = [
  areaListHomeRoute("platform", OrganizationsPage),
  newOrganizationRoute,
  organizationRoute,
];
