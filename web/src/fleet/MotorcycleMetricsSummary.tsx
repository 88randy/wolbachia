import { useTranslation } from "react-i18next";
import type { MotorcycleDetail } from "./fleet-query";
import { useFormatCalendarDate, useFormatNumber } from "../format/use-formatters";
import { FleetSourceLink } from "./FleetSourceLink";
import { FleetFactList } from "./FleetFactList";
type MetricsProps = { motorcycle: MotorcycleDetail };
function EfficiencyFact({ motorcycle }: MetricsProps) {
  const { t } = useTranslation();
  const metrics = motorcycle.metrics;
  if (metrics.latest_efficiency === null || !["ok", "review"].includes(metrics.efficiency_status))
    return <>{t("fleet.gap.insufficient")}</>;
  return (
    <FleetSourceLink code={motorcycle.code} target={{ tab: "fuel" }}>
      {t("fleet.efficiency.value", { value: Number(metrics.latest_efficiency).toFixed(2) })}
    </FleetSourceLink>
  );
}
function ServiceReference({ motorcycle }: MetricsProps) {
  const { t } = useTranslation();
  const source = motorcycle.metrics.last_service;
  if (!source) return <>{t("fleet.summary.unknown")}</>;
  return (
    <FleetSourceLink code={motorcycle.code} target={{ tab: "services", id: source }}>
      {source}
    </FleetSourceLink>
  );
}
function MetricNumbers({ motorcycle }: MetricsProps) {
  const { t } = useTranslation();
  const date = useFormatCalendarDate();
  const number = useFormatNumber();
  const metrics = motorcycle.metrics;
  const unknown = t("fleet.summary.unknown");
  return (
    <FleetFactList
      facts={[
        [
          "fleet.summary.odometer",
          metrics.latest_odometer === null ? unknown : number(metrics.latest_odometer),
        ],
        [
          "fleet.summary.nextKm",
          metrics.next_service_due_km === null ? unknown : number(metrics.next_service_due_km),
        ],
        [
          "fleet.summary.nextDate",
          metrics.next_service_due_date === null ? unknown : date(metrics.next_service_due_date),
        ],
      ]}
    />
  );
}
export function MotorcycleMetricsSummary(props: MetricsProps) {
  return (
    <>
      <MetricNumbers {...props} />
      <FleetFactList
        facts={[
          ["fleet.summary.lastService", <ServiceReference key="service" {...props} />],
          ["fleet.summary.efficiency", <EfficiencyFact key="efficiency" {...props} />],
        ]}
      />
    </>
  );
}
