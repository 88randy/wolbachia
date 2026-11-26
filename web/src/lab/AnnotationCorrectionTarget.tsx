import { useQuery } from "@tanstack/react-query";
import { readTableState } from "../data-table/table-state";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { historyOptions } from "./lab-query";
import type { LabScope } from "./lab-query";
import { HISTORY_TABLE } from "./lab-table";
import { AnnotationVoidTarget } from "./AnnotationVoidTarget";
import { AnnotationUnavailable } from "./AnnotationUnavailable";

export function AnnotationCorrectionTarget(props: { scope: LabScope; code: string }) {
  const query = useQuery(
    historyOptions(props.scope, readTableState({ code: props.code }, HISTORY_TABLE).state),
  );
  if (query.isPending) return <CardSkeleton />;
  if (!query.data)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  const count = query.data.results.find((count) => count.is_current && !count.voided);
  return count ? <AnnotationVoidTarget {...props} count={count} /> : <AnnotationUnavailable />;
}
