import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { useSessionIdentity } from "../session/use-session-identity";
import { VOID_REASONS_RESOURCE, voidReasonsQueryOptions } from "./void-reasons-query";

/** The picker cannot submit unless an available catalog was loaded successfully. */
export function useVoidReasons() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(voidReasonsQueryOptions(client, identity));
  const queryClient = useQueryClient();
  const items = (query.data ?? []).filter((item) => item.is_active);
  return {
    items,
    isCatalogLoading: query.isPending,
    isCatalogBlocked: query.isPending || query.isError || items.length === 0,
    retryCatalog: () => {
      void query.refetch();
    },
    refreshCatalog: () => {
      void invalidateOrgScoped(queryClient, VOID_REASONS_RESOURCE);
    },
  };
}
