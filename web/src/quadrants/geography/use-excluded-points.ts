import { useState } from "react";
import { emptyResolution } from "./use-polygon-draft-state";
import type { QuadrantDraft } from "./use-quadrant-draft";
export function useExcludedPoints(draft: QuadrantDraft, canCreatePoint: boolean) {
  const [retiring, setRetiring] = useState<string | null>(null);
  const update = (value: ReturnType<typeof emptyResolution>) => {
    draft.setResolutions((previous) => ({ ...previous, [value.point]: value }));
  };
  const card = (point: QuadrantDraft["excluded"][number]) => ({
    point,
    value: draft.resolutions[point.id] ?? emptyResolution(point.id),
    onChange: update,
    canCreatePoint,
    isBlocked: draft.blocked.includes(point.id),
    onRetire: () => {
      setRetiring(point.id);
    },
  });
  return {
    retiring,
    card,
    close: () => {
      setRetiring(null);
    },
  };
}
