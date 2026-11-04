/**
 * The areas of the back-office (see web/README.md), one placeholder route each until the real
 * screens land. Names follow docs/glossary.md. Which areas a user may open comes from
 * `GET /api/v1/me/` (#28); until then the sidebar lists all of them.
 */
export type AreaGroup = "main" | "operation" | "resources" | "analysis";

export const AREAS = [
  { id: "home", path: "/", group: "main" },
  { id: "incidents", path: "/incidents", group: "main" },
  { id: "operations", path: "/operations", group: "operation" },
  { id: "quadrants", path: "/quadrants", group: "operation" },
  { id: "releases", path: "/releases", group: "operation" },
  { id: "community", path: "/community", group: "operation" },
  { id: "inventory", path: "/inventory", group: "resources" },
  { id: "fleet", path: "/fleet", group: "resources" },
  { id: "lab", path: "/lab", group: "resources" },
  { id: "people", path: "/people", group: "resources" },
  { id: "dashboards", path: "/dashboards", group: "analysis" },
  { id: "regulatory", path: "/regulatory", group: "analysis" },
  { id: "settings", path: "/settings", group: "analysis" },
] as const;

export type Area = (typeof AREAS)[number];
export type AreaId = Area["id"];
