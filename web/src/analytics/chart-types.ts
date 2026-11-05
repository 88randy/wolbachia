export interface ChartSeries {
  readonly id: string;
  readonly label: string;
  readonly values: readonly number[];
  readonly tone?: 1 | 2 | 3 | 4;
}
export interface ChartProps {
  title: string;
  labels: readonly string[];
  series: readonly ChartSeries[];
  valueSuffix?: string;
}
