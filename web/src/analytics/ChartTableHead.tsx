import { useTranslation } from "react-i18next";
import type { ChartSeries } from "./chart-types";
interface ChartTableHeadProps {
  series: readonly ChartSeries[];
}
export function ChartTableHead({ series }: ChartTableHeadProps) {
  const { t } = useTranslation();
  return (
    <thead>
      <tr>
        <th scope="col">{t("analytics.chart.period")}</th>
        {series.map((item) => (
          <th scope="col" key={item.id}>
            {item.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}
