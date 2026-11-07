import type { MessageKey } from "@wolbachia/i18n";
import { AREAS } from "../router/areas";
const RESOURCE_LABELS: Readonly<Record<string, MessageKey>> = {
  phones: "phones.page.title",
  "rule-parameters": "rules.page.title",
  catalogs: "catalogs.page.title",
  organization: "orgAdmin.organization.title",
  roles: "orgAdmin.roles.title",
  motorcycles: "fleet.page.title",
  versions: "geography.history.title",
};
const INVENTORY_LABELS: Readonly<Record<string, MessageKey>> = {
  supplies: "inventory.page.supplies",
  lots: "inventory.page.lots",
  locations: "inventory.page.locations",
};
function resourceKey(parts: string[], index: number): MessageKey | undefined {
  if (parts[0] !== "inventory") return RESOURCE_LABELS[parts[index] ?? ""];
  if (index === 1) return INVENTORY_LABELS[parts[index] ?? ""];
  if (index === 2 && parts[1] === "lots" && parts[index] === "new") return "inventory.page.newLot";
  return undefined;
}
/** Only known routes become ancestor links; human codes remain plain text. */
export function breadcrumbsOf(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return [];
  return parts.map((part, index) => {
    const area = index === 0 ? AREAS.find((entry) => entry.path === `/${part}`) : undefined;
    const key = area ? (`shell.nav.${area.id}` as MessageKey) : resourceKey(parts, index);
    const path = `/${parts.slice(0, index + 1).join("/")}`;
    return {
      path,
      label: part,
      key,
      isLinked: key !== undefined && part !== "versions",
      isCurrent: index === parts.length - 1,
    };
  });
}
