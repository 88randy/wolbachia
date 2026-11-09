import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import type { TableController } from "../../data-table/table-types";
import type { GeographyScope } from "./use-w-15";
import { pointsOptions } from "./geography-query";
import { usePointColumns } from "./use-point-columns";
import { geographyPageTable } from "./geography-page-table";
import { usePointRetirement } from "./use-point-retirement";
export interface PointsTableOptions {
  scope: GeographyScope;
  quadrant: string;
  controller: TableController;
}
export function usePointsTable({ scope, quadrant, controller }: PointsTableOptions) {
  const [point, setPoint] = useState<Schemas["SamplingPoint"] | null>(null);
  const query = useQuery(pointsOptions(scope, quadrant, controller.state));
  const columns = usePointColumns(setPoint);
  const voidOf = usePointRetirement(scope, quadrant);
  return {
    point,
    table: { ...geographyPageTable(query, controller, columns), voidOf },
    close: () => {
      setPoint(null);
    },
  };
}
