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
  const createLabel = t("geography.points.create");
  return useMemo(
    () => buildColumns({ canCreatePoint, onCreate, onHistory }, createLabel),
    [canCreatePoint, onCreate, onHistory, createLabel],
  );
}
function buildColumns({ canCreatePoint, onCreate, onHistory }: Options, createLabel: string) {
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
