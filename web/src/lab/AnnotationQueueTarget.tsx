import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { readTableState } from "../data-table/table-state";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { queueOptions } from "./lab-query";
import type { LabScope } from "./lab-query";
import { QUEUE_TABLE } from "./lab-table";
import { useAnnotationSaved } from "./use-annotation-saved";
import { AnnotationWorkspace } from "./AnnotationWorkspace";
import { AnnotationUnavailable } from "./AnnotationUnavailable";

export function AnnotationQueueTarget(props: {
  scope: LabScope;
  code: string;
  context: Schemas["LabQueueQueryRequest"];
}) {
  const query = useQuery(
    queueOptions(props.scope, readTableState({ code: props.code }, QUEUE_TABLE).state),
  );
  const onSaved = useAnnotationSaved();
  if (query.isPending) return <CardSkeleton />;
  if (!query.data)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  const bag = query.data.results.find((candidate) => candidate.code === props.code);
  if (!bag) return <AnnotationUnavailable />;
  return (
    <AnnotationWorkspace
      {...props}
      target={{ bagId: bag.id, code: bag.code, revision: bag.expected_revision }}
      onSaved={onSaved}
    />
  );
}
