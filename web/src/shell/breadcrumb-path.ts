import type { MessageKey } from "@wolbachia/i18n";
import { AREAS } from "../router/areas";
const RESOURCE_LABELS: Readonly<Record<string, MessageKey>> = {
  shifts: "shift.page.title",
  plan: "scheduling.plan.menu",
  live: "live.title",
  risk: "scheduling.risk.menu",
  interventions: "scheduling.intervention.title",
  import: "scheduling.import.title",
  assignments: "scheduling.assign.title",
  phones: "phones.page.title",
  "rule-parameters": "rules.page.title",
  catalogs: "catalogs.page.title",
  organization: "orgAdmin.organization.title",
  roles: "orgAdmin.roles.title",
  "incident-types": "incidentTypes.page.title",
  motorcycles: "fleet.page.title",
  versions: "geography.history.title",
  bags: "labReception.page.title",
  "permit-types": "permits.types.title",
  permits: "permits.list.title",
  trainings: "trainings.workspace.title",
  evaluations: "evaluations.page.title",
  reviews: "reviews.workspace.title",
  relocations: "relocations.workspace.title",
  closure: "closure.crumb",
  "write-offs": "allocation.lab.title",
  "egg-counts": "lab.count.title",
  "count-history": "lab.history.title",
<<<<<<< HEAD
  "data-transfers": "regulatory.page.transfers",
  exports: "regulatory.page.exports",
  "arco-requests": "regulatory.page.arco",
  "access-log": "regulatory.page.accessLog",
  "export-receipts": "regulatory.access.tab.exports",
  "portal-settings": "regulatory.page.portal",
=======
  records: "shell.crumb.records",
>>>>>>> origin/develop
};
const INVENTORY_LABELS: Readonly<Record<string, MessageKey>> = {
  transfers: "transfers.page.title",
  discrepancies: "discrepancies.page.title",
  supplies: "inventory.page.supplies",
  lots: "inventory.page.lots",
  locations: "inventory.page.locations",
  assignments: "allocation.assignment.title",
  reconciliations: "allocation.reconciliation.title",
  "write-offs": "allocation.writeOff.title",
};
function resourceKey(parts: string[], index: number): MessageKey | undefined {
  if (parts[0] !== "inventory") return RESOURCE_LABELS[parts[index] ?? ""];
  if (index === 1) return INVENTORY_LABELS[parts[index] ?? ""];
  return lotResourceKey(parts, index);
}
function lotResourceKey(parts: string[], index: number): MessageKey | undefined {
  if (parts[1] !== "lots") return undefined;
  if (index === 2 && parts[index] === "new") return "inventory.page.newLot";
  if (index === 3 && parts[index] === "conditions") return "conditions.page.title";
  return undefined;
}
/** What the router knows about a path: its declared crumb label, and whether it is a route. */
export interface CrumbSource {
  crumbOf: (path: string) => MessageKey | undefined;
  isRoute: (path: string) => boolean;
}

/** Only known routes become ancestor links; human codes remain plain text. */
export function breadcrumbsOf(pathname: string, source?: CrumbSource) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return [];
  return parts.map((part, index) => {
    const area = index === 0 ? AREAS.find((entry) => entry.path === `/${part}`) : undefined;
    const path = `/${parts.slice(0, index + 1).join("/")}`;
    const key = area
      ? (`shell.nav.${area.id}` as MessageKey)
      : (resourceKey(parts, index) ?? source?.crumbOf(path));
    return {
      path,
      label: part,
      key,
      isLinked: key !== undefined && part !== "versions" && (source?.isRoute(path) ?? true),
      isCurrent: index === parts.length - 1,
    };
  });
}
