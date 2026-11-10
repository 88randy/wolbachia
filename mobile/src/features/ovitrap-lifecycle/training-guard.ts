import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readTrainingSource } from "../training/projection-state.ts";
import { TrainingUnavailable } from "../training/types.ts";
import { qualificationForAction } from "../training/domain.ts";
import type { QualificationAction } from "../training/domain.ts";
import type { Eligibility } from "../training/types.ts";
import { LifecycleGateError } from "./action-error-key.ts";
import type { LifecycleDraft, LifecycleSourceTurn } from "./types.ts";
interface GuardInput {
  readonly draft: LifecycleDraft;
  readonly turn: LifecycleSourceTurn;
  readonly now: Date;
}

function requireQualification(rows: readonly Eligibility[], action: QualificationAction): void {
  const configured = rows.some(
    (row) =>
      row.action === action.action &&
      row.center_id === action.centerId &&
      row.quadrant_id === action.quadrantId,
  );
  if (configured && qualificationForAction(rows, action) !== "eligible")
    throw new LifecycleGateError("training");
}

/** A complete current snapshot proves configured absence; it never creates a qualification grant. */
export async function lifecycleTrainingGuards(
  db: SqlExecutor,
  input: GuardInput,
): Promise<readonly SqlStatement[]> {
  const point = input.turn.source?.point;
  if (!point) throw new LifecycleGateError("training");
  const identity = { owner: input.turn.handle.owner, sessionId: input.turn.handle.sessionId };
  const source = await readTrainingSource(db, identity).catch((error: unknown) => {
    if (error instanceof TrainingUnavailable) throw new LifecycleGateError("training");
    throw error;
  });
  const action = {
    action: `ovitrap.${input.draft.kind}`,
    centerId: point.centerId,
    quadrantId: point.quadrantId,
    now: input.now,
  };
  requireQualification(source.eligibility, action);
  return [
    {
      sql: `INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN EXISTS(${source.guard.sql})
      THEN 1 ELSE 0 END)
      ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
      params: source.guard.params,
    },
  ];
}
