import { useQuery } from "@tanstack/react-query";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { requirementsOptions } from "./training-query";
import type { TrainingScope } from "./training-query";
import type { PersonContext } from "./person-context";
import { VERSION_TABLE } from "./training-table";
import { useRequirementColumns } from "./requirement-columns";
const TABLE_SCOPE = { prefix: "requirement_" };
export function useRequirementTable(scope: TrainingScope, context: PersonContext) {
  const table = useTableUrlState(VERSION_TABLE, TABLE_SCOPE);
  const query = useQuery(
    requirementsOptions(scope, {
      center: context.center,
      quadrant: context.quadrant || undefined,
      page: table.state.page,
    }),
  );
  const columns = useRequirementColumns();
  return {
    table,
    query,
    columns,
    isFresh: !query.isFetching && !query.isPlaceholderData && query.isSuccess,
  };
}
