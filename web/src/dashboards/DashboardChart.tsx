/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a dashboard widget; splitting it into one-use fragments would hurt readability. */
import { LineChart } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChartConfig } from "@/components/ui/chart";
import { Card } from "../ui/Card";
import { SelectMenu } from "../ui/SelectMenu";
import { StateFrame } from "../ui/StateFrame";
import { buildChartData } from "./chart-data";
import { ChartDataTable } from "./ChartDataTable";
import { ChartLegendList } from "./ChartLegendList";
import { ChartPlot } from "./ChartPlot";
import type { Dashboard } from "./dashboard-query";
import type { Granularity } from "./dashboard-filters";
import { barColor, seriesColor } from "./series-style";
import { useDashboardText } from "./use-dashboard-text";

type Chart = Dashboard["charts"][number];

const CATEGORY_COLUMNS: Readonly<Record<string, string>> = {
  coverage_by_quadrant: "quadrant",
  incidents_by_state: "state",
};

/** One chart in a card: the drawing, its legend, and its data table. */
export function DashboardChart({ chart, granularity }: { chart: Chart; granularity: Granularity }) {
  const { t } = useTranslation();
  const text = useDashboardText();
  const data = useMemo(() => buildChartData(chart), [chart]);
  const bandSeries = data.series.filter((series) => series.bandKey !== null);
  const [chosen, setChosen] = useState("");
  const selectedBand =
    bandSeries.find((series) => series.dataKey === chosen) ?? bandSeries[0] ?? null;
  const title = text.label(chart.label);
  const config: ChartConfig = Object.fromEntries(
    data.series.map((series, index) => [
      series.dataKey,
      {
        label: text.label(series.source.label),
        color: chart.kind === "bar" ? barColor(index) : seriesColor(index),
      },
    ]),
  );
  const hasPoints = data.rows.length > 0;
  return (
    <Card
      title={title}
      headingLevel={2}
      actions={
        bandSeries.length > 1 ? (
          <div className="w-56">
            <SelectMenu
              id={`band-${chart.key}`}
              ariaLabel={t("analytics.chart.series")}
              value={selectedBand?.dataKey ?? ""}
              options={bandSeries.map((series) => ({
                value: series.dataKey,
                label: config[series.dataKey]?.label ?? series.dataKey,
              }))}
              onValueChange={setChosen}
            />
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        {hasPoints ? (
          <>
            <ChartPlot
              kind={chart.kind}
              unit={chart.unit}
              data={data}
              config={config}
              granularity={granularity}
              bandKey={selectedBand?.bandKey ?? null}
              categoryColumn={CATEGORY_COLUMNS[chart.key] ?? null}
              ariaLabel={title}
            />
            <ChartLegendList data={data} config={config} kind={chart.kind} />
            {selectedBand !== null && (
              <p className="m-0 flex items-center gap-2 text-xs text-ink-2">
                <span aria-hidden="true" className="h-2.5 w-6 rounded-sm bg-action/20" />
                {t("analytics.chart.ciBand")}: {config[selectedBand.dataKey]?.label}
              </p>
            )}
          </>
        ) : (
          <StateFrame icon={LineChart} message={t("analytics.chart.empty")}>
            <p className="m-0 text-[13px] text-ink-2">{t("analytics.chart.emptyHint")}</p>
          </StateFrame>
        )}
        <ChartDataTable table={chart.table} title={title} granularity={granularity} />
      </div>
    </Card>
  );
}
