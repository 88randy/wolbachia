import { useTranslation } from "react-i18next";
import { areaText, lengthText } from "./measure";
import type { MeasureSummary } from "./use-measurements";

/** Perimeter and area of the shape being drawn or selected, as plain text over the map. */
export function MeasurePanel({ summary }: { summary: MeasureSummary }) {
  const { t, i18n } = useTranslation();
  const rows = [
    {
      label: t("mapEditor.measure.perimeter"),
      value: lengthText(t, i18n.language, summary.perimeter),
    },
    { label: t("mapEditor.measure.area"), value: areaText(t, i18n.language, summary.area) },
  ];
  return (
    <section
      aria-label={t("mapEditor.measure.panel")}
      className="pointer-events-none absolute top-2 left-2 max-w-[16rem] rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs shadow-card"
    >
      <h3 className="m-0 mb-1 text-xs font-semibold text-ink">
        {t(summary.kind === "block" ? "mapEditor.measure.block" : "mapEditor.measure.quadrant")}
        {summary.isDrawing ? ` · ${t("mapEditor.measure.drawing")}` : ""}
      </h3>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-ink-2">{row.label}</dt>
            <dd className="m-0 text-right font-semibold text-ink tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
