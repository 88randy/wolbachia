import { ApiError } from "@wolbachia/api-client";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { Refreshing } from "../../ui/Refreshing";
import { ReviewFacts } from "./ReviewFacts";
import { ReviewTimeline } from "./ReviewTimeline";
import type { ReviewRecordState } from "./use-review-record";

export function ReviewReadContent({ state }: { state: ReviewRecordState }) {
  const { query, review } = state;
  if (query.isPending || query.isPlaceholderData) return <CardSkeleton />;
  const error = query.error instanceof ApiError ? query.error.code : undefined;
  const retry = () => {
    void state.refresh();
  };
  if (!review) return <ErrorState code={error} onRetry={retry} />;
  return (
    <>
      {query.isFetching && <Refreshing />}
      {query.isError && <ErrorState code={error} onRetry={retry} />}
      <ReviewFacts review={review} />
      <ReviewTimeline review={review} />
    </>
  );
}
