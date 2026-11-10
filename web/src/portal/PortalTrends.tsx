/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useParams } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { ChartContainer } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PortalCutoff } from "./PortalCutoff";
import { PortalError, PortalLoading, PortalMissing } from "./PortalStates";
import { PortalWeekTable } from "./PortalWeekTable";
import { isPortalMissing, usePortalTrends } from "./portal-data";
import { downloadWeeksCsv } from "./weeks-csv";
import { usePortalFormat } from "./use-portal-format";

const CHART_HEIGHT = 300;
const Y_WIDTH = 48;

/** W70: releases per week, as a bar chart with its table and a CSV of the same numbers. */
export function PortalTrends() {
  const { t } = useTranslation();
  const { orgSlug } = useParams({ strict: false });
  const query = usePortalTrends(orgSlug ?? "");
  const format = usePortalFormat();
  if (query.isPending) return <PortalLoading />;
  if (query.isError)
    return isPortalMissing(query.error) ? (
      <PortalMissing title={t("portal.state.sectionOff")} />
    ) : (
      <PortalError
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  const { weeks, cutoff } = query.data;
  const config: ChartConfig = {
    releases: { label: t("portal.trends.releases"), color: "var(--web-chart-1)" },
  };
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <PortalCutoff iso={cutoff} />
        <h1 className="m-0 text-3xl leading-tight font-bold tracking-tight text-navy">
          {t("portal.trends.title")}
        </h1>
        <p className="m-0 max-w-2xl text-lg leading-7 text-ink-2">{t("portal.trends.lead")}</p>
      </section>
      <Card
        title={t("portal.trends.title")}
        headingLevel={2}
        actions={
          weeks.length > 0 ? (
            <Button
              variant="secondary"
              leadingIcon={<Download aria-hidden="true" />}
              onClick={() => {
                downloadWeeksCsv(weeks, {
                  week: t("portal.trends.week"),
                  releases: t("portal.trends.releases"),
                  quantity: t("portal.trends.quantity"),
                });
              }}
            >
              {t("portal.trends.download")}
            </Button>
          ) : undefined
        }
      >
        {weeks.length === 0 ? (
          <EmptyState kind="noData" message={t("portal.trends.empty")} />
        ) : (
          <div className="flex flex-col gap-6">
            <ChartContainer
              config={config}
              height={CHART_HEIGHT}
              role="img"
              aria-label={t("portal.trends.chartLabel")}
            >
              <BarChart
                data={weeks.map((week) => ({ ...week }))}
                margin={{ top: 8, right: 8, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--web-chart-grid)" />
                <XAxis
                  dataKey="weekStart"
                  tickLine={false}
                  tickMargin={8}
                  minTickGap={16}
                  tickFormatter={(value: string) => format.date(value)}
                />
                <YAxis
                  width={Y_WIDTH}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tickFormatter={(value: number) => format.number(value)}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-tint)" }}
                  content={(tip) =>
                    tip.active && typeof tip.label === "string" ? (
                      <div className="grid gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink shadow-overlay">
                        <p className="m-0 font-semibold">{`${t("portal.trends.week")} ${format.date(tip.label)}`}</p>
                        <p className="m-0 tabular-nums">
                          {`${t("portal.trends.releases")}: ${format.number(Number(tip.payload[0]?.value ?? 0))}`}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Bar
                  dataKey="releases"
                  fill="var(--color-releases)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ChartContainer>
            <PortalWeekTable weeks={weeks} />
          </div>
        )}
      </Card>
    </div>
  );
}
