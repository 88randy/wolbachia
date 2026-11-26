import type { Draft } from "./types.ts";
import type { Snapshots } from "./store.ts";

/** [ASSUMPTION] An unsent draft older than this belongs to an earlier work session. */
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Why an old draft can no longer be saved; the courier is told and can only start again. */
export type StaleInvalidReason = "assignment" | "point" | "scope" | "retired" | "placed";

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
  readonly isRetired?: boolean;
  /** The same scope rule the save trigger applies to a late capture (false = it would be refused). */
  readonly isLateScopeAvailable?: boolean;
}): StaleDraft | null {
  const { draft, shiftId, now, snapshots } = input;
  if (!draft || input.isEvent) return null;
  // A draft already chosen to finish late is checked again every time it is opened: the
  // scope can change after the choice, and the courier must not walk five steps to learn it.
  if (draft.isLate === true) {
    const reason = invalidReason(draft, snapshots, input);
    return reason === null ? null : { createdAt: draft.deviceTime, invalidReason: reason };
  }
  const isOld = now.getTime() - Date.parse(draft.deviceTime) > DRAFT_MAX_AGE_MS;
  if (draft.shiftId === shiftId && !isOld) return null;
  return { createdAt: draft.deviceTime, invalidReason: invalidReason(draft, snapshots, input) };
}

function invalidReason(
  draft: Draft,
  snapshots: Snapshots,
  input: {
    readonly isLabelTaken: boolean;
    readonly isRetired?: boolean;
    readonly isLateScopeAvailable?: boolean;
  },
): StaleInvalidReason | null {
  if (!snapshots.assignment || !snapshots.catalog || !snapshots.rules) return "assignment";
  // The draft is judged on the assignment it was started with, not today's.
  if (draft.point && !draft.assignment?.points.some((point) => point.id === draft.point?.id))
    return "point";
  if (input.isLateScopeAvailable === false) return "scope";
  if (input.isRetired === true) return "retired";
  return input.isLabelTaken ? "placed" : null;
}
