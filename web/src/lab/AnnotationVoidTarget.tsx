import { useQuery } from "@tanstack/react-query";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { voidContextOptions } from "./lab-query";
import type { Count, LabScope } from "./lab-query";
import { useAnnotationSaved } from "./use-annotation-saved";
import { AnnotationWorkspace } from "./AnnotationWorkspace";
import { AnnotationUnavailable } from "./AnnotationUnavailable";

export function AnnotationVoidTarget(props: { scope: LabScope; code: string; count: Count }) {
  const query = useQuery(voidContextOptions(props.scope, props.count.id));
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
  if (!query.data.is_current || query.data.blocked_by.length > 0) return <AnnotationUnavailable />;
  return (
    <AnnotationWorkspace
      scope={props.scope}
      target={{
        bagId: props.count.bag_id,
        code: props.code,
        revision: query.data.current_revision,
        correctionId: props.count.id,
      }}
      context={{}}
      onSaved={onSaved}
    />
  );
}
