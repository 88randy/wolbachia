import { ApiError } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import type { UseQueryResult } from "@tanstack/react-query";
export function isConditionAccessDenied(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}
export function hasConditionCaptureDenial(
  status: UseQueryResult<Schemas["ConditionStatus"]>,
): boolean {
  return (
    status.isSuccess &&
    !status.isFetching &&
    !status.isPlaceholderData &&
    !status.data.can_create_condition
  );
}
