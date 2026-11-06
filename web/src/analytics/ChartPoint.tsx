import { GEOMETRY, chartX, chartY } from "./chart-geometry";
interface ChartPointProps {
  value: number;
  position: number;
  count: number;
  pattern: number;
  domain: { min: number; max: number };
}
/** Each series has a different geometric marker, including in monochrome. */
export function ChartPoint({ value, position, count, pattern, domain }: ChartPointProps) {
  const abscissa = chartX(position, count);
  const ordinate = chartY(value, domain);
  const extent = GEOMETRY.markerSize;
  if (pattern === 0) return <circle cx={abscissa} cy={ordinate} r={extent} />;
  if (pattern === 3)
    return (
      <polygon
        points={`${String(abscissa)},${String(ordinate - extent)} ${String(abscissa + extent)},${String(ordinate + extent)} ${String(abscissa - extent)},${String(ordinate + extent)}`}
      />
    );
  const rotation = pattern === 2 ? `rotate(45 ${String(abscissa)} ${String(ordinate)})` : undefined;
  return (
    <rect
      x={abscissa - extent}
      y={ordinate - extent}
      width={2 * extent}
      height={2 * extent}
      transform={rotation}
    />
  );
}
