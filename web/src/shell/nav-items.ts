import type { MessageKey } from "@wolbachia/i18n";
import {
  Bike,
  Bell,
  Bug,
  ChartColumn,
  FlaskConical,
  House,
  ListChecks,
  Map as MapIcon,
  MessagesSquare,
  Package,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { canOpenArea } from "../router/area-access";
import { AREAS } from "../router/areas";
import type { Area, AreaGroup, AreaId } from "../router/areas";
import type { Me } from "../session/me";

export const AREA_ICONS: Record<AreaId, LucideIcon> = {
  home: House,
  notifications: Bell,
  incidents: TriangleAlert,
  operations: ListChecks,
  quadrants: MapIcon,
  releases: Bug,
  community: MessagesSquare,
  inventory: Package,
  fleet: Bike,
  lab: FlaskConical,
  people: Users,
  dashboards: ChartColumn,
  regulatory: ShieldCheck,
  settings: Settings,
};

const GROUP_HEADINGS: Record<Exclude<AreaGroup, "main">, MessageKey> = {
  operation: "shell.group.operation",
  resources: "shell.group.resources",
  analysis: "shell.group.analysis",
};

export interface NavGroup {
  readonly id: AreaGroup;
  /** Catalog key of the group heading; the first group has none (as in the design). */
  readonly headingKey: MessageKey | undefined;
  readonly areas: readonly Area[];
}

const GROUP_ORDER: readonly AreaGroup[] = ["main", "operation", "resources", "analysis"];

function headingOf(group: AreaGroup): MessageKey | undefined {
  return group === "main" ? undefined : GROUP_HEADINGS[group];
}

/** Sidebar structure: the areas of the router grouped like the design (W2). */
export const NAV_GROUPS: readonly NavGroup[] = GROUP_ORDER.map((id) => ({
  id,
  headingKey: headingOf(id),
  areas: AREAS.filter((area) => area.group === id),
}));

/**
 * The sidebar for one user: only the areas their permissions allow (Home always), and no group
 * heading for a group left empty. Decided from permission codes, never from profile names.
 */
export function visibleNavGroups(me: Pick<Me, "permissions">): readonly NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    areas: group.areas.filter(
      (area) => !("hidden" in area) && canOpenArea(me, area),
    ),
  })).filter((group) => group.areas.length > 0);
}
