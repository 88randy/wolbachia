import { GEOMETRY } from "./chart-geometry";
interface MiniBarShapeProps {
  value: number;
  index: number;
  maximum: number;
  count: number;
}
export function MiniBarShape({ value, index, maximum, count }: MiniBarShapeProps) {
  const plotHeight = GEOMETRY.miniHeight - GEOMETRY.padding;
  const slot = GEOMETRY.width / Math.max(1, count);
  const width = slot / 2;
  const height = (Math.max(0, value) / maximum) * plotHeight;
  const abscissa = index * slot + width / 2;
  const top = plotHeight - height;
  const curve = Math.min(GEOMETRY.barRadius, height / 2);
  const path = `M${String(abscissa)},${String(plotHeight)}V${String(top + curve)}Q${String(abscissa)},${String(top)} ${String(abscissa + curve)},${String(top)}H${String(abscissa + width - curve)}Q${String(abscissa + width)},${String(top)} ${String(abscissa + width)},${String(top + curve)}V${String(plotHeight)}Z`;
  return <path d={path} />;
}
