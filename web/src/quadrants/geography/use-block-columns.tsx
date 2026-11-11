/* eslint-disable max-params, max-lines-per-function -- fast mode (demo 2026-11-20): map measurements, split after the demo. */
import { useMemo } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { geographyColumn } from "./geography-column";
import { BlockGeometry } from "./BlockGeometry";
import { AreaCell } from "./MeasureFacts";
import { lengthDetailText } from "./area-format";
import type { TFunction } from "i18next";
interface Options {
  canCreatePoint: boolean;
  onCreate: (block: Schemas["Block"]) => void;
  onHistory: (block: Schemas["Block"]) => void;
}
export function useBlockColumns({ canCreatePoint, onCreate, onHistory }: Options) {
  const { t, i18n } = useTranslation();
  const createLabel = t("geography.points.create");
  const language = i18n.language;
  return useMemo(
    () => buildColumns({ canCreatePoint, onCreate, onHistory }, createLabel, t, language),
    [canCreatePoint, onCreate, onHistory, createLabel, t, language],
  );
}
function buildColumns(
  { canCreatePoint, onCreate, onHistory }: Options,
  createLabel: string,
  t: TFunction,
  language: string,
) {
  const column = geographyColumn<Schemas["Block"]>;
  const columns = [
    column("code", "geography.field.code", (row) => (
      <button
        type="button"
        onClick={() => {
          onHistory(row);
        }}
      >
        {row.code}
      </button>
    )),
    {
      ...column("area", "geography.field.area", (row) => (
        <AreaCell squareMeters={row.current_version?.area_m2} />
      )),
      align: "end" as const,
    },
    {
      ...column("perimeter", "geography.field.perimeter", (row) =>
        row.current_version?.perimeter_m == null
          ? "—"
          : lengthDetailText(t, language, row.current_version.perimeter_m),
      ),
      align: "end" as const,
    },
    column("geometry", "geography.field.geometry", (row) => <BlockGeometry block={row} />),
  ];
  if (canCreatePoint) columns.push(pointColumn(createLabel, onCreate));
  return columns;
}

function pointColumn(createLabel: string, onCreate: Options["onCreate"]) {
  const column = geographyColumn<Schemas["Block"]>;
  return column("actions", "geography.points.title", (row) => (
    <button
      type="button"
      onClick={() => {
        onCreate(row);
      }}
    >
      {createLabel}
    </button>
  ));
}
