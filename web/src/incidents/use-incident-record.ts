import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDocumentTitle } from "../shell/use-document-title";
import { incidentDetailOptions } from "./incidents-query";
import { useIncidentScope } from "./use-incident-scope";
import { useIncidentCommands } from "./use-incident-commands";

/** A failed background read retains the workspace while keeping its commands blocked. */
export function useIncidentRecord(code: string) {
  const scope = useIncidentScope();
  const search = useSearch({ strict: false });
  const query = useQuery(incidentDetailOptions(scope, code));
  const commands = useIncidentCommands(scope, query.data?.id ?? "");
  useDocumentTitle(code);
  const review = async () => {
    const result = await query.refetch();
    if (result.isSuccess) commands.clearFailure();
  };
  return {
    query,
    search: Object.fromEntries(
      Object.entries(search).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
    retry: () => {
      void query.refetch();
    },
    workspace: { scope, commands, isFetching: query.isFetching || query.isError, review },
  };
}
