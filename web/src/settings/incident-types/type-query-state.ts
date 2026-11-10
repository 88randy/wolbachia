import type { useW06 } from "./use-w-06";
export type TypeSelectionQuery =
  ReturnType<typeof useW06>["selected"] | ReturnType<typeof useW06>["unconfigured"];
/** A retained RAM target never establishes current command readiness. */
export function isCurrentTypeRead(query: TypeSelectionQuery): boolean {
  return query.data !== undefined && !query.isFetching && !query.isPlaceholderData && !query.error;
}
