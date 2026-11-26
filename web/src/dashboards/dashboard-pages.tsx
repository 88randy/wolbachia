import { useTranslation } from "react-i18next";
import { DashboardPage } from "./DashboardPage";

/** W55 Operations dashboard: coverage, tasks, incidents and fuel. */
export function W55Page() {
  const { t } = useTranslation();
  return (
    <DashboardPage
      kind="operations"
      title={t("analytics.dashboards.operations.title")}
      description={t("analytics.dashboards.operations.description")}
      defaultPeriod="4w"
    />
  );
}

/** W53 Entomology dashboard: positive ovitrap index and eggs per ovitrap. */
export function W53Page() {
  const { t } = useTranslation();
  return (
    <DashboardPage
      kind="entomology"
      title={t("analytics.dashboards.entomology.title")}
      description={t("analytics.dashboards.entomology.description")}
      defaultPeriod="12w"
      wideCharts={["index_trend_by_quadrant"]}
    />
  );
}

/** W54 Wolbachia prevalence: weekly prevalence with its 95 % Wilson interval. */
export function W54Page() {
  const { t } = useTranslation();
  return (
    <DashboardPage
      kind="wolbachia-prevalence"
      title={t("analytics.dashboards.prevalence.title")}
      description={t("analytics.dashboards.prevalence.description")}
      defaultPeriod="12w"
      wideCharts={["wolbachia_prevalence"]}
    />
  );
}
