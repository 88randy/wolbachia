/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): one declarative screen. */
import { useMemo } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { geographyColumn } from "./geography-column";
export function usePointColumns(
  onHistory: (point: Schemas["SamplingPoint"]) => void,
  blockCode: (id: string) => string,
  quadrantCode: string,
) {
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
      column("block", "geography.field.block", (row) => blockCode(row.block)),
      {
        ...column(
          "view",
          "geography.points.view",
          (row) => t("labTrace.map.viewPoint") + " " + row.code,
        ),
        link: (row) => ({
          to: "/quadrants/$code/points/$pointCode",
          params: { code: quadrantCode, pointCode: row.code },
        }),
      },
      column("status", "geography.field.status", (row) =>
        t(row.current_version?.is_retired ? "geography.status.retired" : "geography.status.active"),
      ),
    ],
    [t, onHistory, column, blockCode, quadrantCode],
  );
}
