import { useQuery } from "@tanstack/react-query";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { annotationOptions } from "./annotation-query";
import { AnnotationViewerImage } from "./AnnotationViewerImage";
import type { LabScope } from "./lab-query";

export function AnnotationViewerContent(props: { scope: LabScope; countId: string }) {
  const query = useQuery(annotationOptions(props.scope, props.countId));
  if (query.isPending) return <CardSkeleton />;
  if (!query.data)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return <AnnotationViewerImage scope={props.scope} annotation={query.data} />;
}
