import { useTranslation } from "react-i18next";
import type { HubCardItem } from "../components/templates/HubCard";
import type { HomeSummary } from "../discovery/discovery-query";
import { HOME_CARDS } from "./home-cards";

/** The summary cards with work to do ("Lo que tienes pendiente") and every card as a KPI. */
export function useHomeCards(summary: HomeSummary | undefined) {
  const { t } = useTranslation();
  const cards = summary?.cards ?? [];
  const all = cards.flatMap((card): HubCardItem[] => {
    const config = HOME_CARDS[card.key];
    if (config === undefined) return [];
    return [
      {
        id: card.key,
        title: t(config.title),
        description: t(config.description),
        icon: config.icon,
        link: config.link,
        count: card.value,
        tone: config.tone,
      },
    ];
  });
  const pending = all.filter(
    (item) => HOME_CARDS[item.id]?.isPending === true && (item.count ?? 0) > 0,
  );
  return { pending, all };
}
