import { useMemo } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { geographyColumn } from "./geography-column";
import { BlockGeometry } from "./BlockGeometry";
interface Options {
  canCreatePoint: boolean;
  onCreate: (block: Schemas["Block"]) => void;
  onHistory: (block: Schemas["Block"]) => void;
}
export function useBlockColumns({ canCreatePoint, onCreate, onHistory }: Options) {
  const { t } = useTranslation();
  return useMemo(
    () => buildColumns({ canCreatePoint, onCreate, onHistory }, t),
    [canCreatePoint, onCreate, onHistory, t],
  );
}
function buildColumns(
  { canCreatePoint, onCreate, onHistory }: Options,
  t: ReturnType<typeof useTranslation>["t"],
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
    column("geometry", "geography.field.geometry", (row) => <BlockGeometry block={row} />),
  ];
  if (canCreatePoint) columns.push(pointColumn(t, onCreate));
  return columns;
}

function pointColumn(t: ReturnType<typeof useTranslation>["t"], onCreate: Options["onCreate"]) {
  const column = geographyColumn<Schemas["Block"]>;
  return column("actions", "geography.points.title", (row) => (
    <button
      type="button"
      onClick={() => {
        onCreate(row);
      }}
    >
      {t("geography.points.create")}
    </button>
  ));
}
