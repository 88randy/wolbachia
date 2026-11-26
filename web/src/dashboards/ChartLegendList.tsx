/* eslint-disable max-lines-per-function -- presentational JSX of a dashboard widget; splitting it into one-use fragments would hurt readability. */
import type { ChartConfig } from "@/components/ui/chart";
import type { ChartData } from "./chart-data";
import { seriesDash } from "./series-style";

/** Legend with the color AND the line pattern of each series (never color alone). */
export function ChartLegendList({
  data,
  config,
  kind,
}: {
  data: ChartData;
  config: ChartConfig;
  kind: "bar" | "line";
}) {
  if (data.series.length < 2) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-xs text-ink-2">
      {data.series.map((series, index) => (
        <li key={series.dataKey} className="flex items-center gap-2">
          <svg aria-hidden="true" width="24" height="10" className="flex-none">
            {kind === "bar" ? (
              <rect x="4" y="1" width="16" height="8" rx="2" fill={config[series.dataKey]?.color} />
            ) : (
              <line
                x1="0"
                x2="24"
                y1="5"
                y2="5"
                stroke={config[series.dataKey]?.color}
                strokeWidth="2.5"
                strokeDasharray={seriesDash(index)}
              />
            )}
          </svg>
          {config[series.dataKey]?.label}
        </li>
      ))}
    </ul>
  );
}
