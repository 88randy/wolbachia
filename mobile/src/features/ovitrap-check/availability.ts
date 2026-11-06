import type { Draft } from "./types.ts";
import type { Snapshots } from "./store.ts";
export function availability(draft: Draft | null, current: Snapshots) {
  const catalogChanged = Boolean(
    draft?.catalog && current.catalog && draft.catalog.version !== current.catalog.version,
  );
  const isScopeBlocked =
    Boolean(draft && !current.assignment) ||
    Boolean(
      draft?.point &&
      current.assignment &&
      !current.assignment.points.some((point) => point.id === draft.point?.id),
    );
  return { catalogChanged, isScopeBlocked };
}
