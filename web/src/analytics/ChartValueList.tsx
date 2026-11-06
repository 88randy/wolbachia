import { useLanguage } from "../i18n/use-language";
import type { ChartSeries } from "./chart-types";
interface ChartValueListProps {
  series: readonly ChartSeries[];
  index: number;
  suffix: string;
}
export function ChartValueList({ series, index, suffix }: ChartValueListProps) {
  const { language } = useLanguage();
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  return (
    <dl>
      {series.map((item) => (
        <div key={item.id}>
          <dt>{item.label}</dt>
          <dd>
            {number.format(item.values[index] ?? Number.NaN)}
            {suffix}
          </dd>
        </div>
      ))}
    </dl>
  );
}
