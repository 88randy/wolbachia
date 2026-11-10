import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useMe } from "../../session/use-me";
import { useSessionIdentity } from "../../session/use-session-identity";
import { canCreatePermit } from "./permissions";
import { PERMITS_TABLE, permitsOptions } from "./permits-query";

/** State of W44: the table in the address bar, its server page and who may create a permit. */
export function usePermitsScreen() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const controller = useTableUrlState(PERMITS_TABLE);
  const query = useQuery(permitsOptions(client, identity, controller.state));
  return { controller, query, canCreate: canCreatePermit(useMe()) };
}
