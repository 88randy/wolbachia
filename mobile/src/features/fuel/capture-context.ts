import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { CaptureTransportHandle } from "../ovitrap-lifecycle/capture-context-contract.ts";
import { CURRENT_CAPTURE_CONTEXT } from "../ovitrap-lifecycle/context-sql.ts";
import { FuelError } from "./domain.ts";

export interface FuelCaptureSource {
  readonly guard: SqlStatement;
  readonly handle: CaptureTransportHandle;
  readonly canUpload: boolean;
}

const READ_SOURCE = `SELECT context.value AS context,profile.value AS profile,
  EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='field.upload') AS can_upload
  FROM (${CURRENT_CAPTURE_CONTEXT}) context JOIN kv profile ON profile.key='session_profile'
  WHERE json_extract(context.value,'$.ownerKey')=? AND json_extract(context.value,'$.sessionId')=?
    AND json_extract(context.value,'$.scopeRevision')=? AND json_extract(context.value,'$.authorityRevision')=?
    AND json_extract(profile.value,'$.issuer')=? AND json_extract(profile.value,'$.sessionId')=?
    AND json_extract(profile.value,'$.userId')=? AND json_extract(profile.value,'$.organization.id')=?
    AND EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='field_event.sync')
    AND EXISTS(SELECT 1 FROM json_each(context.value,'$.context.grants') grant
      WHERE json_extract(grant.value,'$.centers.mode')='all' OR
        (json_extract(grant.value,'$.centers.mode')='selected'
          AND json_array_length(grant.value,'$.centers.ids')>0))`;

function sourceParams(handle: CaptureTransportHandle) {
  return [
    ownerKey(handle.owner),
    handle.sessionId,
    handle.scopeRevision,
    handle.revision,
    handle.owner.issuer,
    handle.sessionId,
    handle.owner.userId,
    handle.owner.organizationId,
  ];
}

/** The open shift pins the motorcycle; a downloaded scope is never reconstructed from Me labels. */
export async function readFuelCaptureContext(
  db: SqlExecutor,
  handle: CaptureTransportHandle,
): Promise<FuelCaptureSource> {
  if (!handle.isCurrent() || handle.scopeRevision === null) throw new FuelError("scope");
  const params = sourceParams(handle);
  const [row] = await db.query(READ_SOURCE, params);
  if (!row || !handle.isCurrent()) throw new FuelError("scope");
  return {
    handle,
    canUpload: row.can_upload === 1,
    guard: {
      sql: `SELECT 1 FROM (${READ_SOURCE}) source WHERE context=? AND profile=?`,
      params: [...params, readText(row, "context"), readText(row, "profile")],
    },
  };
}
