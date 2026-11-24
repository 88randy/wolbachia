import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { AnnotationViewerSurface } from "./AnnotationViewerSurface";
import { annotationImageOptions } from "./annotation-query";
import { useBlobUrl } from "./use-blob-url";
import type { LabScope } from "./lab-query";

export function AnnotationViewerImage({
  scope,
  annotation,
}: {
  scope: LabScope;
  annotation: Schemas["EggAnnotation"];
}) {
  const query = useQuery(annotationImageOptions(scope, annotation.upload_id));
  const url = useBlobUrl(query.data);
  if (query.isPending) return <CardSkeleton />;
  if (!url)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return <AnnotationViewerSurface annotation={annotation} url={url} />;
}
