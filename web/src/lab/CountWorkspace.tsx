import { useQuery } from "@tanstack/react-query";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { QUEUE_TABLE } from "./lab-table";
import { queueOptions } from "./lab-query";
import type { LabScope } from "./lab-query";
import { CountWorkspaceBody } from "./CountWorkspaceBody";
/** Initial loading owns no editable state; loaded candidates are pinned in the body. */
export function CountWorkspace({ scope, draftKey }: { scope: LabScope; draftKey: string }) {
  const controller = useTableUrlState(QUEUE_TABLE);
  const query = useQuery(queueOptions(scope, controller.state));
  if (query.isPending) return <CardSkeleton />;
  if (!query.data) return <ErrorState onRetry={() => { void query.refetch(); }} />;
  return <CountWorkspaceBody scope={scope} draftKey={draftKey} controller={controller} initial={query.data.results[0] ?? null} />;
}
