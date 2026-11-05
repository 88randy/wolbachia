import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useQuadrantColumns } from "./use-quadrant-columns";
import { QUADRANT_TABLE, PAGE_SIZE } from "./geography-table";
import { quadrantListOptions } from "./geography-query";
import { pageTableData } from "../../data-table/table-data";
import type { GeographyScope } from "./use-w-15";
export function useQuadrantList(scope: GeographyScope) {
  const controller = useTableUrlState(QUADRANT_TABLE);
  const query = useQuery(quadrantListOptions(scope, controller.state));
  const [isCreating, setCreating] = useState(false);
  const columns = useQuadrantColumns();
  const table = {
    columns,
    controller,
    data: pageTableData(query, controller.state.page, PAGE_SIZE),
    getRowId: (row: Schemas["Quadrant"]) => row.id,
  };
  return {
    table,
    query,
    isCreating,
    open: () => {
      setCreating(true);
    },
    close: () => {
      setCreating(false);
    },
  };
}
