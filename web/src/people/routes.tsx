import { createRoute } from "@tanstack/react-router";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { ForbiddenError } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { W51Page } from "./evaluations/W51Page";
import { PeopleHome } from "./PeopleHome";
import { W50Page } from "./trainings/W50Page";

const trainingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/people/trainings",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    if (!context.me.permissions.some((code) => ["training.read", "training.manage"].includes(code)))
      throw new ForbiddenError("people");
  },
  component: W50Page,
  errorComponent: AreaErrorState,
});
const evaluationsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/people/evaluations",
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    if (
      !context.me.permissions.some((code) =>
        ["evaluation.read", "evaluation.create"].includes(code),
      )
    )
      throw new ForbiddenError("people");
  },
  component: W51Page,
  errorComponent: AreaErrorState,
});

/** People area: W49 home, W50 trainings, W51 evaluations. */
export const peopleRoutes = [areaHomeRoute("people", PeopleHome), trainingsRoute, evaluationsRoute];
