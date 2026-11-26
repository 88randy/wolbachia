import { useTranslation } from "react-i18next";
import { areaDetailText, compactAreaText, lengthDetailText } from "./area-format";

interface Props {
  version: { area_m2?: number | null; perimeter_m?: number | null } | null | undefined;
}

/** Area and perimeter stored with the current version (computed by the server on save). */
export function MeasureFacts({ version }: Props) {
  const { t, i18n } = useTranslation();
  if (version?.area_m2 == null || version.perimeter_m == null) return null;
  const rows = [
    { label: t("geography.field.area"), value: areaDetailText(t, i18n.language, version.area_m2) },
    {
      label: t("geography.field.perimeter"),
      value: lengthDetailText(t, i18n.language, version.perimeter_m),
    },
  ];
  return (
    <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex gap-2">
          <dt className="text-ink-2">{row.label}</dt>
          <dd className="m-0 font-semibold text-ink tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Table cell: compact area of a record's current version, or an em dash. */
export function AreaCell({ squareMeters }: { squareMeters: number | null | undefined }) {
  const { t, i18n } = useTranslation();
  return squareMeters == null ? "—" : compactAreaText(t, i18n.language, squareMeters);
}
