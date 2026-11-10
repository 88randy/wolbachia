import { PendingState } from "../../states/PendingState";
import { NotFoundState } from "../../states/NotFoundState";
import { ErrorState } from "../../ui/ErrorState";
import { ApiError } from "@wolbachia/api-client";
import { useClosureModel } from "./use-closure-model";
import type { ClosureProps } from "./use-closure-model";
import { ClosureScreen } from "./ClosureScreen";
export function ClosureWorkspace(props: ClosureProps) {
  const model = useClosureModel(props);
  const { query } = model;
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status))
    return <NotFoundState />;
  if (!query.data && query.error) return <ErrorState onRetry={model.refresh} />;
  if (!query.data || query.isPlaceholderData) return <PendingState />;
  if (query.data.quadrant_id !== props.quadrant.id) return <NotFoundState />;
  return <ClosureScreen model={model} readiness={query.data} />;
}
