import { useLanguage } from "../i18n/use-language";
import type { ChartProps } from "./chart-types";
export function ChartTableBody({ labels, series, valueSuffix = "" }: ChartProps) {
  const { language } = useLanguage();
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  return (
    <tbody>
      {labels.map((label, index) => (
        <tr key={index}>
          <th scope="row">{label}</th>
          {series.map((item) => (
            <td key={item.id}>
              {number.format(item.values[index] ?? Number.NaN)}
              {valueSuffix}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
