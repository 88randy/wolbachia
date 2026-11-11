import { useUrlCenter } from "../../centers/use-url-center";
import type { Schemas } from "@wolbachia/api-client";
import { useCenterColumns } from "../../data-table/center-column";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { geographyColumn } from "./geography-column";
export function useQuadrantColumns() {
  const format = useFormatDateTime();
  const center = useUrlCenter();
  const column = geographyColumn<Schemas["Quadrant"]>;
  const columns = [
    {
      ...column("code", "geography.field.code", (row) => row.code),
      link: (row: Schemas["Quadrant"]) => ({
        to: "/quadrants/$code/versions" as const,
        params: { code: row.code },
        search: center ? { center } : {},
      }),
    },
    column("created_at", "geography.field.created", (row) => format(row.created_at)),
  ];
  return useCenterColumns(columns, (row) => row.center, { after: "code" });
}
