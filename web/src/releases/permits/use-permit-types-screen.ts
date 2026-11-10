import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useMe } from "../../session/use-me";
import { useSessionIdentity } from "../../session/use-session-identity";
import { canCreatePermitType } from "./permissions";
import { PERMIT_TYPES_TABLE, permitTypesOptions } from "./permits-query";

/** State of W43: the table in the address bar, its server page and who may create a type. */
export function usePermitTypesScreen() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const controller = useTableUrlState(PERMIT_TYPES_TABLE);
  const query = useQuery(permitTypesOptions(client, identity, controller.state));
  return {
    controller,
    query,
    canCreate: canCreatePermitType(useMe()),
    isFirstUse: query.data?.count === 0 && !controller.hasActiveFilters,
  };
}
