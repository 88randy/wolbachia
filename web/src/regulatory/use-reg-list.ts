import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { cursorTableData } from "../data-table/table-data";
import type { TableQueryConfig, TableState } from "../data-table/table-types";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useSessionIdentity } from "../session/use-session-identity";
import type { RegScope } from "./reg-queries";

interface CursorPage<Row> {
  next?: string | null | undefined;
  previous?: string | null | undefined;
  results: Row[];
}

export function useRegScope(): RegScope {
  return { client: useApiClient(), identity: useSessionIdentity() };
}

/** A cursor list of the regulatory area: filters in the address, rows from the server. */
export function useRegList<Row>(
  table: TableQueryConfig,
  options: (
    scope: RegScope,
    state: TableState,
  ) => UseQueryOptions<CursorPage<Row>, Error, CursorPage<Row>>,
) {
  const scope = useRegScope();
  const controller = useTableUrlState(table);
  const query = useQuery({
    ...options(scope, controller.state),
    enabled: scope.identity.isSettled,
    select: (page) => ({
      next: page.next ?? null,
      previous: page.previous ?? null,
      results: page.results,
    }),
  });
  return { controller, data: cursorTableData(query) };
}
