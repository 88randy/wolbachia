import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@wolbachia/api-client";
import type { GeographyScope } from "../../quadrants/geography/use-w-15";
import { quadrantRecordOptions } from "../../quadrants/geography/geography-query";
import { PendingState } from "../../states/PendingState";
import { NotFoundState } from "../../states/NotFoundState";
import { ErrorState } from "../../ui/ErrorState";
import { useDocumentTitle } from "../../shell/use-document-title";
import { ClosureWorkspace } from "./ClosureWorkspace";
export function ClosureRecord({ scope, code }: { scope: GeographyScope; code: string }) {
  const query = useQuery(quadrantRecordOptions(scope, code));
  useDocumentTitle(code);
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status))
    return <NotFoundState />;
  if (query.error)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  if (query.isPending || query.isPlaceholderData) return <PendingState />;
  if (!query.data) return <NotFoundState />;
  return (
    <ClosureWorkspace
      scope={scope}
      quadrant={query.data}
      refreshQuadrant={() => {
        void query.refetch();
      }}
      isRecordFetching={query.isFetching}
    />
  );
}
