import { ApiError } from "@wolbachia/api-client";
import { ErrorState } from "../ui/ErrorState";

export function IncidentReadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <ErrorState code={error instanceof ApiError ? error.code : undefined} onRetry={onRetry} />;
}
