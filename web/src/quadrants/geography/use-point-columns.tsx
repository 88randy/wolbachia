import { useMemo } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { geographyColumn } from "./geography-column";
export function usePointColumns(onHistory: (point: Schemas["SamplingPoint"]) => void) {
  const { t } = useTranslation();
  const column = geographyColumn<Schemas["SamplingPoint"]>;
  return useMemo(
    () => [
      column("code", "geography.points.code", (row) => (
        <button
          type="button"
          onClick={() => {
            onHistory(row);
          }}
        >
          {row.code}
        </button>
      )),
      column("block", "geography.field.block", (row) => row.block),
      column("location", "geography.field.location", (row) =>
        row.current_version?.location.join(","),
      ),
      column("status", "geography.field.status", (row) =>
        t(row.current_version?.is_retired ? "geography.status.retired" : "geography.status.active"),
      ),
    ],
    [t, onHistory, column],
  );
}
