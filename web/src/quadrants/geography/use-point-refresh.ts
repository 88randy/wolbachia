import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { tableErrorKey } from "../../data-table/table-error";
import { useSessionGuard } from "../../session/use-session-guard";
import { pointRecordOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";
export function usePointRefresh(
  scope: GeographyScope,
  point: string,
  onRefreshed: (point: Schemas["SamplingPoint"]) => void,
) {
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const refresh = async () => {
    const guard = begin();
    try {
      const updated = await queryClient.query({
        ...pointRecordOptions(scope, point),
        staleTime: 0,
      });
      if (!guard.isStale()) {
        onRefreshed(updated);
        setFailure(null);
      }
    } catch (caught) {
      if (!guard.isStale()) setFailure(tableErrorKey(caught));
    }
  };
  return { refresh, failure };
}
