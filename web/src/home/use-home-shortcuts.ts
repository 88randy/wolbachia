import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import type { HubCardItem } from "../components/templates/HubCard";
import type { AreaId } from "../router/areas";
import { useMe } from "../session/use-me";
import { visibleNavGroups } from "../shell/nav-items";
import { AREA_ICONS } from "../shell/nav-items";

const DESCRIPTIONS: Partial<Record<AreaId, MessageKey>> = {
  notifications: "hub.notifications.description",
  incidents: "hub.incidents.description",
  operations: "hub.operations.description",
  quadrants: "hub.quadrants.description",
  releases: "hub.releases.description",
  inventory: "hub.inventory.description",
  fleet: "hub.fleet.description",
  lab: "hub.lab.description",
  people: "hub.people.description",
  settings: "hub.settings.description",
};

/** One card per area in the user's sidebar (same permission rules), Home itself excluded. */
export function useHomeShortcuts(): HubCardItem[] {
  const { t } = useTranslation();
  const me = useMe();
  return visibleNavGroups(me)
    .flatMap((group) => group.areas)
    .filter((area) => area.id !== "home")
    .map((area) => {
      const description = DESCRIPTIONS[area.id];
      return {
        id: area.id,
        icon: AREA_ICONS[area.id],
        link: { to: area.path },
        title: t(`shell.nav.${area.id}`),
        description: description ? t(description) : "",
      };
    });
}
