import { useUrlCenter } from "../../centers/use-url-center";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { geographyColumn } from "./geography-column";
export function useQuadrantColumns() {
  const format = useFormatDateTime();
  const center = useUrlCenter();
  const column = geographyColumn<Schemas["Quadrant"]>;
  return [
    {
      ...column("code", "geography.field.code", (row) => row.code),
      link: (row: Schemas["Quadrant"]) => ({
        to: "/quadrants/$code/versions" as const,
        params: { code: row.code },
        search: center ? { center } : {},
      }),
    },
    column("center", "geography.field.center", (row) => row.center),
    column("created_at", "geography.field.created", (row) => format(row.created_at)),
  ];
}
