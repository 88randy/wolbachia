import type { Query, QueryClient } from "@tanstack/react-query";
import type { SessionGuard } from "../../session/use-session-guard";
import { organizationOptions } from "./use-w-03";
import type { AdminContext, Organization } from "./use-w-03";
/** Organization settings are global within the actor's grants, across center filter variants. */
export async function publishOrganization(
  context: AdminContext & { queryClient: QueryClient },
  result: Organization,
  guard: SessionGuard,
): Promise<boolean> {
  if (guard.isStale()) return false;
  const filters = {
    queryKey: organizationOptions(context).queryKey.slice(0, 5),
    predicate: (query: Query) => query.meta?.["authorization"] === context.identity.authorization,
  };
  await context.queryClient.cancelQueries(filters);
  if (guard.isStale()) return false;
  context.queryClient.setQueriesData<Organization>(filters, (previous) =>
    previous && previous.revision > result.revision ? previous : result,
  );
  return true;
}
