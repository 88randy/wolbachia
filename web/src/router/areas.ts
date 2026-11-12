/**
 * The areas of the back-office (see web/README.md), one placeholder route each until the real
 * screens land. Names follow docs/glossary.md.
 *
 * `requiredPermissions` says who may open the area (decided in #28):
 * - a list of permission codes: the user needs at least ONE of them (`GET /me/` permissions);
 * - an empty list: every signed-in member (Home);
 * - `"pending"`: the issue that builds the area has not defined its permission code yet, so every
 *   member sees it until then. A test lists these areas; each issue replaces its `"pending"`.
 *
 * `hidden: true` keeps an area without screens out of the sidebar and Home (no dead links).
 */
export type AreaGroup = "main" | "operation" | "resources" | "analysis" | "platform";

export const PENDING = "pending";

export const AREAS = [
  { id: "home", path: "/", group: "main", requiredPermissions: [] },
  {
    id: "notifications",
    path: "/notifications",
    group: "main",
    requiredPermissions: ["notification.read"],
  },
  { id: "incidents", path: "/incidents", group: "main", requiredPermissions: ["incident.read"] },
  {
    id: "operations",
    path: "/operations",
    group: "operation",
    requiredPermissions: ["shift.read", "review_item.read", "relocation.read"],
  },
  {
    id: "scheduling",
    path: "/scheduling",
    group: "operation",
    requiredPermissions: ["schedule.read", "intervention.read", "risk_import.apply"],
  },
  {
    id: "quadrants",
    path: "/quadrants",
    group: "operation",
    requiredPermissions: ["quadrant.read"],
  },
  {
    id: "releases",
    path: "/releases",
    group: "operation",
    requiredPermissions: ["release.read", "permit.manage"],
  },
  {
    id: "community",
    path: "/community",
    group: "operation",
    requiredPermissions: ["community_activity.read"],
  },
  {
    id: "inventory",
    path: "/inventory",
    group: "resources",
    requiredPermissions: [
      "supply_type.read",
      "lot.read",
      "location.read",
      "transfer.read",
      "discrepancy.read",
      "inventory.allocate",
      "inventory.reconcile",
      "inventory.write_off",
    ],
  },
  { id: "fleet", path: "/fleet", group: "resources", requiredPermissions: ["motorcycle.read"] },
  {
    id: "lab",
    path: "/lab",
    group: "resources",
    requiredPermissions: [
      "egg_count.create",
      "egg_count.read",
      "bag.receive",
      "bag.dispose",
      "recount.create",
      "recount.adjudicate",
      "egg_paddle.reuse",
      "shipment.read",
      "sample.read",
      "material_request.read",
      "pcr.read",
    ],
  },
  {
    id: "people",
    path: "/people",
    group: "resources",
    requiredPermissions: [
      "training.read",
      "training.manage",
      "evaluation.read",
      "evaluation.create",
    ],
  },
  {
    id: "dashboards",
    path: "/dashboards",
    group: "analysis",
    requiredPermissions: [
      "analytics.operations.read",
      "analytics.entomology.read",
      "analytics.wolbachia.read",
    ],
  },
  {
    id: "regulatory",
    path: "/regulatory",
    group: "analysis",
    requiredPermissions: [
      "transfer_authorization.read",
      "export.run",
      "arco_request.read",
      "access_log.read",
      "portal.manage",
    ],
  },
  {
    id: "settings",
    path: "/settings",
    group: "analysis",
    // Codes that exist today (docs/api-conventions.md, #3 and #4); W62 to W68 refine them.
    requiredPermissions: [
      "catalog.read",
      "rule_parameter_version.read",
      "device.read",
      "organization.read",
      "role.read",
      "incident.manage_type",
      "user.read",
    ],
  },
  // Platform admins only (`/me/` is_platform_admin), never an organization permission.
  {
    id: "platform",
    path: "/platform",
    group: "platform",
    requiredPermissions: [],
    platformOnly: true,
  },
] as const;

export type Area = (typeof AREAS)[number];
export type AreaId = Area["id"];
