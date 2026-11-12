import type { Draft } from "./types.ts";
import type { Snapshots } from "./store.ts";

/** [ASSUMPTION] An unsent draft older than this belongs to an earlier work session. */
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Why an old draft can no longer be saved; the courier is told and can only start again. */
export type StaleInvalidReason = "assignment" | "point" | "placed";

export interface StaleDraft {
  /** When the draft was really made (its original device time). */
  readonly createdAt: string;
  readonly invalidReason: StaleInvalidReason | null;
}

/**
 * An unfinished draft from a previous day or a closed shift. Never reused silently: the courier
 * chooses (finish it with its original time, or start again). `null` while the draft is current,
 * or after the courier already chose to finish it.
 */
export function staleDraft(input: {
  readonly draft: Draft | null;
  readonly isEvent: boolean;
  readonly shiftId: string | null;
  readonly now: Date;
  readonly snapshots: Snapshots;
  readonly isLabelTaken: boolean;
}): StaleDraft | null {
  const { draft, shiftId, now, snapshots } = input;
  if (!draft || input.isEvent || draft.isLate === true) return null;
  const isOld = now.getTime() - Date.parse(draft.deviceTime) > DRAFT_MAX_AGE_MS;
  if (draft.shiftId === shiftId && !isOld) return null;
  return { createdAt: draft.deviceTime, invalidReason: invalidReason(draft, snapshots, input) };
}

function invalidReason(
  draft: Draft,
  snapshots: Snapshots,
  input: { readonly isLabelTaken: boolean },
): StaleInvalidReason | null {
  if (!snapshots.assignment || !snapshots.catalog || !snapshots.rules) return "assignment";
  if (draft.point && !snapshots.assignment.points.some((point) => point.id === draft.point?.id))
    return "point";
  return input.isLabelTaken ? "placed" : null;
}
