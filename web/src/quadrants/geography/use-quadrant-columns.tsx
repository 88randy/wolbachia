import { useQuery } from "@tanstack/react-query";
import { useUrlCenter } from "../../centers/use-url-center";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../../api/ApiClientProvider";
import { centersOptions } from "../../centers/centers-query";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useSessionIdentity } from "../../session/use-session-identity";
import { geographyColumn } from "./geography-column";
export function useQuadrantColumns() {
  const format = useFormatDateTime();
  const center = useUrlCenter();
  const centers = useQuery(centersOptions(useApiClient(), useSessionIdentity()));
  const nameOf = new Map((centers.data ?? []).map((item) => [item.id, item.name]));
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
    column("center", "mapEditor.field.center", (row) => nameOf.get(row.center) ?? "—"),
    column("created_at", "geography.field.created", (row) => format(row.created_at)),
  ];
}
