import { lazy, Suspense } from "react";
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import { IncidentsPage } from "./IncidentsPage";
import { WeeklyIndexChart } from "./WeeklyIndexChart";
import { CountForm } from "./CountForm";

const MapPoc = lazy(() => import("./MapPoc"));

const root = createRootRoute({ component: () => <Outlet /> });

// The query string is the table state. Invalid values fall back instead of crashing.
export const incidentsSearch = z.object({
  page: z.number().int().min(1).catch(1),
  status: z.enum(["open", "closed"]).optional().catch(undefined),
  ordering: z.enum(["code", "-code", "created_at", "-created_at"]).catch("-created_at"),
});

export const incidentsRoute = createRoute({
  getParentRoute: () => root,
  path: "/incidents",
  validateSearch: incidentsSearch,
  component: IncidentsPage,
});
const dashboardRoute = createRoute({ getParentRoute: () => root, path: "/dashboard", component: WeeklyIndexChart });
const countRoute = createRoute({ getParentRoute: () => root, path: "/count", component: CountForm });
const mapRoute = createRoute({
  getParentRoute: () => root,
  path: "/map",
  component: () => (
    <Suspense fallback={null}>
      <MapPoc />
    </Suspense>
  ),
});

const routeTree = root.addChildren([incidentsRoute, dashboardRoute, countRoute, mapRoute]);
export const makeRouter = (history?: Parameters<typeof createRouter>[0]["history"]) =>
  createRouter({ routeTree, history });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof makeRouter>;
  }
}
