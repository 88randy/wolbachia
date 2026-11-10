import { ApiError } from "@wolbachia/api-client";
/** A definitive target denial retires accepted private content even before /me changes. */
export function isTypeAccessDenied(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}
export function visibleTypeQuery<T extends { data: unknown; error: unknown }>(query: T) {
  return isTypeAccessDenied(query.error) ? { ...query, data: undefined } : query;
}
