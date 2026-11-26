import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { otherCentersOptions, readinessOptions } from "./centers-api";
import type { CenterRow, ReadinessRow } from "./centers-api";
import { useCentersScope } from "./use-centers-scope";

export interface CloseFlow {
  center: CenterRow;
  rows: readonly ReadinessRow[];
  preparedTransfers: number;
  isChecking: boolean;
  isLoadError: boolean;
  blockingTotal: number;
  readyCount: number;
  destinationCenter: string;
  setDestinationCenter: (id: string) => void;
  destinationWarehouse: string;
  setDestinationWarehouse: (id: string) => void;
  recheck: () => void;
}

/** One live checklist for closing a center, with the destinations shared by every step. */
export function useCloseFlow(center: CenterRow): CloseFlow {
  const scope = useCentersScope();
  const queryClient = useQueryClient();
  const readiness = useQuery(readinessOptions(scope, center.id));
  const others = useQuery(otherCentersOptions(scope, center.id));
  const [pickedCenter, setDestinationCenter] = useState("");
  const [destinationWarehouse, setDestinationWarehouse] = useState("");
  // The most likely destination: the one other active center, when there is only one.
  const onlyOther = others.data?.length === 1 ? others.data[0]?.id : undefined;
  const rows = readiness.data?.rows ?? [];
  const blocking = rows.filter((row) => row.is_blocking);
  return {
    center,
    rows,
    preparedTransfers: readiness.data?.prepared_transfer_count ?? 0,
    isChecking: readiness.isFetching,
    isLoadError: readiness.isError,
    blockingTotal: blocking.length,
    readyCount: blocking.filter((row) => row.count === 0).length,
    destinationCenter: pickedCenter || (onlyOther ?? ""),
    setDestinationCenter,
    destinationWarehouse,
    setDestinationWarehouse,
    recheck: () => {
      void queryClient.invalidateQueries({ queryKey: readinessOptions(scope, center.id).queryKey });
    },
  };
}
