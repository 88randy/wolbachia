import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import type { TableController } from "../../data-table/table-types";
import type { GeographyScope } from "./use-w-15";
import { blocksOptions } from "./geography-query";
import { useBlockColumns } from "./use-block-columns";
import { geographyPageTable } from "./geography-page-table";
export interface BlocksTableOptions {
  scope: GeographyScope;
  quadrant: string;
  controller: TableController;
}
export function useBlocksTable({ scope, quadrant, controller }: BlocksTableOptions) {
  const [block, setBlock] = useState<Schemas["Block"] | null>(null);
  const [history, setHistory] = useState<Schemas["Block"] | null>(null);
  const query = useQuery(blocksOptions(scope, quadrant, controller.state));
  const columns = useBlockColumns({
    canCreatePoint: scope.canCreatePoint,
    onCreate: setBlock,
    onHistory: setHistory,
  });
  return {
    table: geographyPageTable(query, controller, columns),
    block,
    history,
    closeCreate: () => {
      setBlock(null);
    },
    closeHistory: () => {
      setHistory(null);
    },
  };
}
