/**
 * The areas of the back-office (see web/README.md), one placeholder route each until the real
 * screens land. Names follow docs/glossary.md.
 *
 * `requiredPermissions` says who may open the area (decided in #28):
 * - a list of permission codes: the user needs at least ONE of them (`GET /me/` permissions);
 * - an empty list: every signed-in member (Home);
 * - `"pending"`: the issue that builds the area has not defined its permission code yet, so every
 *   member sees it until then. A test lists these areas; each issue replaces its `"pending"`.
 */
export type AreaGroup = "main" | "operation" | "resources" | "analysis";

export const PENDING = "pending";

export const AREAS = [
  { id: "home", path: "/", group: "main", requiredPermissions: [] },
  { id: "incidents", path: "/incidents", group: "main", requiredPermissions: ["incident.read"] },
  {
    id: "operations",
    path: "/operations",
    group: "operation",
    requiredPermissions: ["shift.read", "review_item.read", "relocation.read"],
  },
  {
    id: "quadrants",
    path: "/quadrants",
    group: "operation",
    requiredPermissions: ["quadrant.read"],
  },
  { id: "releases", path: "/releases", group: "operation", requiredPermissions: PENDING },
  { id: "community", path: "/community", group: "operation", requiredPermissions: PENDING },
  {
    id: "inventory",
    path: "/inventory",
    group: "resources",
    requiredPermissions: ["supply_type.read", "lot.read", "location.read"],
  },
  { id: "fleet", path: "/fleet", group: "resources", requiredPermissions: ["motorcycle.read"] },
  {
    id: "lab",
    path: "/lab",
    group: "resources",
    requiredPermissions: ["egg_count.create", "egg_count.read", "bag.receive"],
  },
  { id: "people", path: "/people", group: "resources", requiredPermissions: PENDING },
  { id: "dashboards", path: "/dashboards", group: "analysis", requiredPermissions: PENDING },
  { id: "regulatory", path: "/regulatory", group: "analysis", requiredPermissions: PENDING },
  {
    id: "settings",
    path: "/settings",
    group: "analysis",
    // Codes that exist today (docs/api-conventions.md, #3 and #4); W62 to W68 refine them.
    requiredPermissions: [
      "catalog.read",
      "rule_parameter.read",
      "device.read",
      "organization.read",
      "role.read",
      "incident.manage_type",
    ],
  },
] as const;

export type Area = (typeof AREAS)[number];
export type AreaId = Area["id"];
