import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import "../router/crumb";
import { tableSearchSchema } from "../data-table/table-search-schema";
import { areaHomeRoute } from "../router/area-route";
import { authenticatedRoute } from "../router/base-routes";
import { requirePermission } from "../router/guards";
import { AreaErrorState } from "../states/AreaErrorState";

const RiskImportPage = lazyRouteComponent(() => import("./RiskImportPage"), "RiskImportPage");
const SchedulingHome = lazyRouteComponent(() => import("./SchedulingHome"), "SchedulingHome");
const W25Page = lazyRouteComponent(() => import("./W25Page"), "W25Page");
const W26Page = lazyRouteComponent(() => import("./W26Page"), "W26Page");
const W27Page = lazyRouteComponent(() => import("./W27Page"), "W27Page");
const W32Page = lazyRouteComponent(() => import("./W32Page"), "W32Page");

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
