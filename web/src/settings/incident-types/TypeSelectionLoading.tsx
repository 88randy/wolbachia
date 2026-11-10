import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
export function TypeSelectionLoading({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return error ? <ErrorState onRetry={onRetry} /> : <CardSkeleton />;
}
