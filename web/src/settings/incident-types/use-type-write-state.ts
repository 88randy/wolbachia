import { useState } from "react";
import { ApiError } from "@wolbachia/api-client";
import { useTypeAttempt } from "./use-type-attempt";
export function useTypeWriteState(revision: number) {
  const attempt = useTypeAttempt(revision);
  const [error, setError] = useState<unknown>(null);
  const [needsReview, setNeedsReview] = useState(false);
  function rejected(failure: unknown) {
    setError(failure);
    setNeedsReview(
      !(failure instanceof ApiError) || failure.status === 409 || failure.status >= 500,
    );
  }
  function reviewed() {
    setNeedsReview(false);
    setError(null);
  }
  function start() {
    setError(null);
    return attempt.start();
  }
  return { ...attempt, start, error, needsReview, rejected, reviewed };
}
export type TypeWriteState = ReturnType<typeof useTypeWriteState>;
