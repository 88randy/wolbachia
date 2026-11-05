import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { VOID_REASONS_KEY, voidReasonsQueryOptions } from "./void-reasons-query";

/** The picker cannot submit unless an available catalog was loaded successfully. */
export function useVoidReasons() {
  const query = useQuery(voidReasonsQueryOptions(useApiClient()));
  const queryClient = useQueryClient();
  const items = query.data ?? [];
  return {
    items,
    isCatalogLoading: query.isPending,
    isCatalogBlocked: query.isPending || query.isError || items.length === 0,
    retryCatalog: () => {
      void query.refetch();
    },
    refreshCatalog: () => {
      void queryClient.invalidateQueries({ queryKey: VOID_REASONS_KEY });
    },
  };
}
