import { readText } from "../../db/sql.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { OvitrapStore } from "../ovitrap-check/store.ts";
import { availability } from "../ovitrap-check/availability.ts";
import type { QrKind } from "../ovitrap-check/types.ts";
import { LifecycleGateError } from "../ovitrap-lifecycle/action-error-key.ts";
import type { LifecycleSourceTurn } from "../ovitrap-lifecycle/types.ts";
import { readSupplyAssignments } from "../supply-receipt/projection-state.ts";
import { SupplyProjectionUnavailable } from "../supply-receipt/projection-types.ts";
import { readReleaseProjection, ReleaseProjectionUnavailable } from "../releases/projections.ts";

export interface ScannerResource {
  readonly kind: QrKind;
  readonly id: string;
  readonly code: string | null;
  /** The label code printed large on an ovitrap (`OVT-0001`); typed by hand when the QR fails. */
  readonly shortCode?: string | null;
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
    db.query(`SELECT id, json_extract(body,'$.code') AS short_code FROM lifecycle_courier_projection
      WHERE kind='ovitrap'
      UNION SELECT json_extract(draft,'$.replacementId') AS id, NULL AS short_code FROM lifecycle_capture
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
        shortCode: typeof row.short_code === "string" ? row.short_code : null,
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
async function releaseResources(
  db: SqlExecutor,
  turn: LifecycleSourceTurn,
): Promise<ScannerResource[]> {
  try {
    const source = await turn.write(() => readReleaseProjection(db, turn.handle));
    const devices = source.permits.flatMap((permit) => permit.capture?.devices ?? []);
    return devices
      .filter((device, index) => devices.findIndex(({ id }) => id === device.id) === index)
      .map((device) => ({
        kind: "release-device",
        id: device.id,
        code: device.code,
        isRetired: device.status === "retired",
      }));
  } catch (error) {
    if (!(error instanceof ReleaseProjectionUnavailable)) throw error;
    return [];
  }
}

/**
 * The bags a scan may bind: only while an unsaved capture of a live ovitrap is open at a point the
 * save would accept (`availability`, the same scope gate as saving). Null otherwise. `bags` are the
 * optional downloaded QR-to-code mappings; the day bundle carries none.
 */
export async function readBagContext(db: SqlExecutor, turn: LifecycleSourceTurn) {
  const store = new OvitrapStore(db);
  const { draft, event } = await turn.write(() => store.read());
  const snapshots = await turn.write(() => store.snapshots());
  if (!draft?.point || event || !turn.canCapture) return null;
  if (availability(draft, snapshots).isScopeBlocked) return null;
  const { isRetired } = await turn.write(() => store.lifecycleSource(draft.ovitrapId, draft.point));
  return isRetired ? null : { bags: snapshots.assignment?.bags ?? [] };
}

async function bagResources(db: SqlExecutor, turn: LifecycleSourceTurn) {
  const current = await readBagContext(db, turn);
  if (!current) return [];
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
    ...(await releaseResources(db, turn)),
  ];
  await turn.assertCurrent();
  return resources;
}
