import { Bug, ChartLine, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HubCardItem } from "../components/templates/HubCard";
import { HubPage } from "../components/templates/HubPage";
import { can } from "../session/can";
import { useMe } from "../session/use-me";
import { ENTOMOLOGY_READ, OPERATIONS_READ, WOLBACHIA_READ } from "./permissions";

/** Analysis home: one card per dashboard the user may read. */
export function DashboardsHome() {
  const { t } = useTranslation();
  const me = useMe();
  const candidates: (HubCardItem | false)[] = [
    can(me, OPERATIONS_READ) && {
      id: "operations",
      icon: ListChecks,
      link: { to: "/dashboards/operations" },
      title: t("analytics.dashboards.operations.title"),
      description: t("analytics.dashboards.operations.description"),
    },
    can(me, ENTOMOLOGY_READ) && {
      id: "entomology",
      icon: Bug,
      link: { to: "/dashboards/entomology" },
      title: t("analytics.dashboards.entomology.title"),
      description: t("analytics.dashboards.entomology.description"),
    },
    can(me, WOLBACHIA_READ) && {
      id: "prevalence",
      icon: ChartLine,
      link: { to: "/dashboards/wolbachia-prevalence" },
      title: t("analytics.dashboards.prevalence.title"),
      description: t("analytics.dashboards.prevalence.description"),
    },
  ];
  const items = candidates.filter((item) => item !== false);
  return (
    <HubPage
      title={t("shell.nav.dashboards")}
      description={t("analytics.dashboards.hubDescription")}
      items={items}
    />
  );
}
