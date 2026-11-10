import { createRoute } from "@tanstack/react-router";
import "../router/crumb";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";
import { RiskImportPage } from "./RiskImportPage";
import { SchedulingHome } from "./SchedulingHome";
import { W25Page } from "./W25Page";
import { W26Page } from "./W26Page";
import { W27Page } from "./W27Page";
import { W32Page } from "./W32Page";

const planRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/scheduling/plan",
  staticData: { crumb: "scheduling.plan.menu" },
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("scheduling", context.me, "schedule.read");
  },
  component: W26Page,
  errorComponent: AreaErrorState,
});
const assignmentsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/scheduling/assignments",
  staticData: { crumb: "scheduling.assign.title" },
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("scheduling", context.me, "schedule.read");
  },
  component: W25Page,
  errorComponent: AreaErrorState,
});
const riskRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/scheduling/risk",
  staticData: { crumb: "scheduling.risk.menu" },
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("scheduling", context.me, "schedule.read");
  },
  component: W27Page,
  errorComponent: AreaErrorState,
});
const riskImportRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/scheduling/risk/import",
  staticData: { crumb: "scheduling.import.title" },
  beforeLoad: ({ context }) => {
    requirePermission("scheduling", context.me, "risk_import.apply");
  },
  component: RiskImportPage,
  errorComponent: AreaErrorState,
});
const interventionsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/scheduling/interventions",
  staticData: { crumb: "scheduling.intervention.title" },
  validateSearch: tableSearchSchema,
  beforeLoad: ({ context }) => {
    requirePermission("scheduling", context.me, "intervention.read");
  },
  component: W32Page,
  errorComponent: AreaErrorState,
});

/** Scheduling area: W26 plan, W25 quadrant assignment, W27 risk categories, W32 interventions. */
export const schedulingRoutes = [
  areaHomeRoute("scheduling", SchedulingHome),
  planRoute,
  assignmentsRoute,
  riskRoute,
  riskImportRoute,
  interventionsRoute,
];
