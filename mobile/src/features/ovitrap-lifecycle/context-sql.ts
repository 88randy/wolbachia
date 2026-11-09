/** Feature-private metadata in the existing KV store; historical migration helpers stay frozen. */
export const CAPTURE_CONTEXT_KEY = "lifecycle_capture_context";
export const LIFECYCLE_BOOTSTRAP_PENDING = "lifecycle_bootstrap_pending";
export const CURRENT_AUTHORITY_REVISION = `COALESCE((SELECT json_extract(value,'$.authorityRevision')
  FROM kv WHERE key='ovitrap_snapshots'),0)`;
export const CURRENT_CAPTURE_CONTEXT = `SELECT value FROM kv WHERE key='${CAPTURE_CONTEXT_KEY}'
  AND json_extract(value,'$.ready')=1
  AND json_extract(value,'$.authorityRevision')=${CURRENT_AUTHORITY_REVISION}
  AND NOT EXISTS(SELECT 1 FROM kv WHERE key='day_cleanup_pending' AND value='true')`;
function dimensionMatches(dimension: string, id: string): string {
  return `(json_extract(grant.value,'$.${dimension}.mode')='all' OR
    (json_extract(grant.value,'$.${dimension}.mode')='selected' AND ${id} IN
      (SELECT value FROM json_each(grant.value,'$.${dimension}.ids'))))`;
}
/** One whole SYNC pair, a current canonical point and its real quadrant/block relation. */
export function capturePointScopeSql(pointId: string, requireOpen = true): string {
  return `SELECT 1 FROM (${CURRENT_CAPTURE_CONTEXT}) context
    JOIN day_sampling_point point ON point.id=${pointId} AND point.removed=0
    JOIN lifecycle_courier_projection quadrant ON quadrant.kind='quadrant'
      AND quadrant.id=json_extract(point.payload,'$.quadrant_id')
    JOIN lifecycle_courier_projection block ON block.kind='block' AND block.id=json_extract(point.payload,'$.block_id')
    JOIN json_each(context.value,'$.context.grants') grant
    WHERE json_extract(point.payload,'$.is_retired')=0
      AND json_extract(quadrant.body,'$._available')=1
      AND json_extract(block.body,'$._available')=1
      AND json_extract(block.body,'$.quadrant_id')=json_extract(point.payload,'$.quadrant_id')
      AND json_extract(block.body,'$.center_id')=json_extract(quadrant.body,'$.center_id')
      AND json_extract(quadrant.body,'$.is_closed') ${requireOpen ? "=0" : "IN (0,1)"}
      AND ${dimensionMatches("centers", "json_extract(quadrant.body,'$.center_id')")}
      AND ${dimensionMatches("quadrants", "json_extract(point.payload,'$.quadrant_id')")}`;
}
export const RETAINED_PROJECTION_KINDS =
  "'lifecycle.owned-draft','lifecycle.owned-source','lifecycle.reviewed-proposal'";
