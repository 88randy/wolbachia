import type { MessageKey } from "@wolbachia/i18n";
import { Globe, Map as MapIcon, TrendingUp } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { HubCardItem } from "../components/templates/HubCard";
import type { AreaId } from "../router/areas";
import { can } from "../session/can";
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
  const areas = visibleNavGroups(me)
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
  return [...areas, ...portalShortcuts(t, me)];
}

/** `portal.read` opens the read-only public portal: one card per page, with the slug of the session. */
function portalShortcuts(t: TFunction, me: ReturnType<typeof useMe>): HubCardItem[] {
  const orgSlug = me.organization?.slug;
  if (orgSlug === undefined || !can(me, "portal.read")) return [];
  const params = { orgSlug };
  return [
    {
      id: "portal-home",
      icon: Globe,
      link: { to: "/portal/$orgSlug", params },
      title: t("portal.nav.summary"),
      description: t("hub.portal.summary"),
    },
    {
      id: "portal-trends",
      icon: TrendingUp,
      link: { to: "/portal/$orgSlug/trends", params },
      title: t("portal.nav.trends"),
      description: t("hub.portal.trends"),
    },
    {
      id: "portal-map",
      icon: MapIcon,
      link: { to: "/portal/$orgSlug/map", params },
      title: t("portal.nav.map"),
      description: t("hub.portal.map"),
    },
  ];
}
