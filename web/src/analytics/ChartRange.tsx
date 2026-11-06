import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import type { ChartProps } from "./chart-types";
import { ChartRangeInput } from "./ChartRangeInput";
interface ChartRangeProps extends ChartProps {
  active: number | null;
  onSelect: (index: number | null) => void;
}
/** A keyboard period inspector announces the exact values that the tooltip shows. */
export function ChartRange(props: ChartRangeProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  const index = props.active ?? 0;
  const values = props.series
    .map(
      (item) =>
        `${item.label}: ${number.format(item.values[index] ?? Number.NaN)}${props.valueSuffix ?? ""}`,
    )
    .join(", ");
  const description = `${props.labels[index] ?? ""}: ${values}`;
  return (
    <ChartRangeInput
      label={`${t("analytics.chart.position")}: ${props.title}`}
      description={description}
      index={index}
      maximum={Math.max(0, props.labels.length - 1)}
      onSelect={props.onSelect}
    />
  );
}
