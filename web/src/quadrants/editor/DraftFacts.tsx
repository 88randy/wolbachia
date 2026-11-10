import { useTranslation } from "react-i18next";

interface Props {
  areaKm2: number;
  points: number;
  blocks?: number;
}

/** Area and counts of the shape on the map, right aligned with tabular figures. */
export function DraftFacts({ areaKm2, points, blocks }: Props) {
  const { t, i18n } = useTranslation();
  const area = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(areaKm2);
  const rows = [
    { label: t("mapEditor.fact.area"), value: t("mapEditor.fact.areaValue", { area }) },
    { label: t("mapEditor.fact.points"), value: String(points) },
    ...(blocks === undefined ? [] : [{ label: t("mapEditor.fact.blocks"), value: String(blocks) }]),
  ];
  return (
    <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-xl bg-surface-muted px-3 py-2.5 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-ink-2">{row.label}</dt>
          <dd className="m-0 text-right font-semibold text-ink tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
