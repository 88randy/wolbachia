import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { useSessionIdentity } from "../session/use-session-identity";
import { VOID_REASONS_RESOURCE, voidReasonsQueryOptions } from "./void-reasons-query";

/** Reasons that only make sense when material leaves the inventory (write-offs), never for a void. */
export const WRITE_OFF_REASON_CODES: readonly string[] = ["expired", "damaged", "lost"];

/**
 * Which reasons a picker offers: `void` (default) hides the write-off reasons, `writeOff` offers
 * only those plus "Other". Both read the same organization catalog.
 */
export type ReasonKind = "void" | "writeOff";

function isOffered(item: { code: string; is_other: boolean }, kind: ReasonKind) {
  const isWriteOff = WRITE_OFF_REASON_CODES.includes(item.code);
  return kind === "writeOff" ? isWriteOff || item.is_other : !isWriteOff;
}

/** The picker cannot submit unless an available catalog was loaded successfully. */
export function useVoidReasons(kind: ReasonKind = "void") {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(voidReasonsQueryOptions(client, identity));
  const queryClient = useQueryClient();
  const items = (query.data ?? []).filter((item) => item.is_active && isOffered(item, kind));
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
