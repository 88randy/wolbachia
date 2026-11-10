import { readText } from "../../db/sql.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { OvitrapStore } from "../ovitrap-check/store.ts";
import type { Assignment, Draft, QrKind } from "../ovitrap-check/types.ts";
import { LifecycleGateError } from "../ovitrap-lifecycle/action-error-key.ts";
import type { LifecycleSourceTurn } from "../ovitrap-lifecycle/types.ts";
import { readSupplyAssignments } from "../supply-receipt/projection-state.ts";
import { SupplyProjectionUnavailable } from "../supply-receipt/projection-types.ts";

export interface ScannerResource {
  readonly kind: QrKind;
  readonly id: string;
  readonly code: string | null;
  readonly isRetired?: boolean;
  readonly supply?: {
    readonly assignmentId: string;
    readonly revision: number;
    readonly date: string;
    readonly lineId: string;
    readonly unitId: string;
    readonly expected: string;
  };
}

async function resolveOvitrap(turn: LifecycleSourceTurn, id: string) {
  try {
    return await turn.resolve({ kind: "new", ovitrapId: id });
  } catch (error) {
    if (!(error instanceof LifecycleGateError) || error.gate !== "scope") throw error;
    return null;
  }
}

async function ovitrapResources(db: SqlExecutor, turn: LifecycleSourceTurn) {
  const rows = await turn.write(() =>
    db.query(`SELECT id FROM lifecycle_courier_projection WHERE kind='ovitrap'
      UNION SELECT json_extract(draft,'$.replacementId') AS id FROM lifecycle_capture
      WHERE kind='replace' AND json_extract(draft,'$.replacementId') IS NOT NULL ORDER BY id`),
  );
  const resources: ScannerResource[] = [];
  for (const row of rows) {
    const source = await resolveOvitrap(turn, readText(row, "id"));
    if (source)
      resources.push({
        kind: "ovitrap",
        id: source.physical.id,
        code: source.point.code,
        isRetired: source.isRetired,
      });
  }
  return resources;
}

async function lotResources(db: SqlExecutor, turn: LifecycleSourceTurn) {
  try {
    const source = await turn.write(() => readSupplyAssignments(db, turn.handle));
    return source.assignments.flatMap((assignment) =>
      assignment.lines.map((line): ScannerResource => ({
        kind: "lot",
        id: line.lot_id,
        code: null,
        supply: {
          assignmentId: assignment.id,
          revision: assignment.revision,
          date: assignment.date,
          lineId: line.id,
          unitId: line.unit_version_id,
          expected: line.quantity,
        },
      })),
    );
  } catch (error) {
    if (!(error instanceof SupplyProjectionUnavailable)) throw error;
    return [];
  }
}

function assignedBagContext(draft: Draft | null, assignment: Assignment | null) {
  if (!draft?.point || !assignment) return null;
  const pointId = draft.point.id;
  const isAssigned =
    assignment.points.some(({ id }) => id === pointId) &&
    assignment.ovitraps.some(({ id, point }) => id === draft.ovitrapId && point.id === pointId);
  return isAssigned ? { pointId, ovitrapId: draft.ovitrapId, bags: assignment.bags } : null;
}

async function bagResources(db: SqlExecutor, turn: LifecycleSourceTurn) {
  const store = new OvitrapStore(db);
  const { draft, event } = await turn.write(() => store.read());
  const { assignment } = await turn.write(() => store.snapshots());
  if (event || !turn.canCapture) return [];
  const current = assignedBagContext(draft, assignment);
  if (!current) return [];
  const source = await resolveOvitrap(turn, current.ovitrapId);
  if (!source || source.isRetired || source.point.id !== current.pointId) return [];
  return current.bags.map((bag): ScannerResource => ({
    kind: "bag",
    id: bag.id,
    code: bag.code,
  }));
}

/** Read only current locally authorized scanner destinations; never infer missing catalog fields. */
export async function readScannerResources(
  db: SqlExecutor,
  turn: LifecycleSourceTurn,
): Promise<readonly ScannerResource[]> {
  const resources = [
    ...(await ovitrapResources(db, turn)),
    ...(await lotResources(db, turn)),
    ...(await bagResources(db, turn)),
  ];
  await turn.assertCurrent();
  return resources;
}
