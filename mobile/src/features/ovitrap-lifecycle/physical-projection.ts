import { readPhysicalIdentityState } from "./physical-identity-state.ts";
import { readText } from "../../db/sql.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { OvitrapStore } from "../ovitrap-check/store.ts";
import { courierPhysical } from "./courier-projections.ts";
import type { Point } from "../ovitrap-check/types.ts";
import type { Schemas } from "@wolbachia/api-client";
import type { LifecycleDraft, PhysicalOvitrap } from "./types.ts";
const EFFECTIVE = `e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
  (SELECT 1 FROM lifecycle_void v JOIN outbox_event ve ON ve.id=v.event_id
   WHERE v.target_event_id=c.event_id AND ve.local_status NOT IN ('rejected','in_review'))`;
async function replacementBase(
  db: SqlExecutor,
  id: string,
): Promise<Omit<PhysicalOvitrap, "isRetired"> | null> {
  const [row] = await db.query(
    `SELECT c.draft FROM lifecycle_capture c JOIN outbox_event e ON e.id=c.event_id
    WHERE c.kind='replace' AND json_extract(c.draft,'$.replacementId')=? AND ${EFFECTIVE}`,
    [id],
  );
  if (!row) return null;
  const draft = JSON.parse(readText(row, "draft")) as LifecycleDraft;
  return { id, point: draft.point, replacedBy: null };
}
async function basePhysical(
  db: SqlExecutor,
  id: string,
): Promise<Omit<PhysicalOvitrap, "isRetired"> | null> {
  const capture = new OvitrapStore(db);
  const snapshots = await capture.snapshots();
  const local = await localBase(capture, id);
  const replacement = await replacementBase(db, id);
  const downloaded = await courierPhysical(db, id);
  const authorizedPoint = snapshots.assignment?.points.find(
    (item) => item.id === downloaded?.trap.sampling_point_id,
  );
  const point =
    downloadedPoint(authorizedPoint, downloaded?.point) ?? local.point ?? replacement?.point;
  if (!point) return null;
  return { id, point, replacedBy: null };
}
export async function physicalOvitrap(
  db: SqlExecutor,
  id: string,
): Promise<PhysicalOvitrap | null> {
  const base = await basePhysical(db, id);
  if (!base) return null;
  const [outgoing] = await db.query(
    `SELECT c.draft FROM lifecycle_capture c JOIN outbox_event e ON e.id=c.event_id
    WHERE c.ovitrap_id=? AND c.kind IN ('replace','remove') AND ${EFFECTIVE} ORDER BY c.rowid DESC LIMIT 1`,
    [id],
  );
  const state = await readPhysicalIdentityState(db, { id, pointId: base.point.id });
  const draft = outgoing ? (JSON.parse(readText(outgoing, "draft")) as LifecycleDraft) : null;
  return { ...base, ...state, replacedBy: draft?.replacementId ?? null };
}

function downloadedPoint(
  authorized: Point | undefined,
  downloaded: Schemas["SamplingPointBundle"] | null | undefined,
): Point | undefined {
  if (!authorized || !downloaded) return authorized;
  return {
    ...authorized,
    lng: downloaded.location[0] ?? authorized.lng,
    lat: downloaded.location[1] ?? authorized.lat,
  };
}
async function localBase(capture: OvitrapStore, id: string) {
  const snapshots = await capture.snapshots();
  const assigned = snapshots.assignment?.ovitraps.find((item) => item.id === id);
  const placed = await capture.projection(id);
  return { point: assigned?.point ?? placed?.point };
}
