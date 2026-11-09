import type { SqlExecutor } from "../../src/db/sql.ts";
import type { Assignment } from "../../src/features/ovitrap-check/types.ts";
import type { EvidenceIdentity } from "../../src/attachments/evidence-session.ts";
import { DayStore } from "../../src/features/day/store.ts";
import { DayBundleService } from "../../src/features/day/bundle-service.ts";
import { CONTRACT_IDS } from "./lifecycle-contract-fixtures.ts";
import {
  PROJECTION_IDENTITY,
  PROJECTION_NOW,
  projectionBundle,
} from "./lifecycle-projection-fixtures.ts";

/** Explicit producer-shaped current permission for M09 captures; no default runtime provider. */
export async function hydrateLifecycleCaptureFixture(
  db: SqlExecutor,
  assignment: Assignment | null,
  options: { readonly force?: boolean; readonly identity?: EvidenceIdentity | null } = {},
): Promise<void> {
  if (
    !options.force &&
    (await db.query("SELECT value FROM kv WHERE key='lifecycle_capture_context'")).length
  )
    return;
  const identity = options.identity === undefined ? PROJECTION_IDENTITY : options.identity;
  const body = fixtureBundle(assignment, identity);
  const service = new DayBundleService({
    store: new DayStore(db),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => identity,
    transport: () => Promise.resolve({ kind: "bundle", body }),
  });
  await service.refresh();
}
export function fixtureBundle(
  assignment: Assignment | null,
  identity: EvidenceIdentity | null = PROJECTION_IDENTITY,
) {
  const base = projectionBundle();
  return {
    ...base,
    capture_context: fixtureCaptureContext(identity),
    sampling_points: fixturePoints(assignment),
    ovitraps: (assignment?.ovitraps ?? []).map((trap) => ({
      id: trap.id,
      client_uuid: trap.id,
      sampling_point_id: trap.point.id,
      version: "fixture-physical",
      placement_voided: false,
      is_retired: false,
    })),
    quadrants: fixtureQuadrants(assignment),
  };
}
function fixtureCaptureContext(identity: EvidenceIdentity | null) {
  if (identity === null) return null;
  return {
    ...projectionBundle().capture_context,
    user_id: identity.owner.userId,
    organization_id: identity.owner.organizationId,
    grants: [
      {
        centers: { mode: "selected", ids: [CONTRACT_IDS.center] },
        quadrants: { mode: "all", ids: [] },
      },
    ],
  };
}
function fixturePoints(assignment: Assignment | null) {
  return (assignment?.points ?? []).map((point) => ({
    id: point.id,
    code: point.code,
    block_id: point.id,
    quadrant_id: point.id,
    version: 1,
    is_retired: false,
    location: [point.lng, point.lat],
  }));
}
function fixtureQuadrants(assignment: Assignment | null) {
  return (assignment?.points ?? []).flatMap((point) => [
    {
      resource_type: "quadrant",
      id: point.id,
      quadrant_id: point.id,
      center_id: CONTRACT_IDS.center,
      code: "Q-FIXTURE",
      revision: 1,
      is_closed: false,
      closure_id: null,
    },
    {
      resource_type: "block",
      id: point.id,
      quadrant_id: point.id,
      center_id: CONTRACT_IDS.center,
      code: "B-FIXTURE",
      revision: 1,
    },
  ]);
}
